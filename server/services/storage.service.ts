/**
 * Lapisan penyimpanan berkas: disk lokal atau object storage S3-kompatibel.
 *
 * MASALAH YANG DIPECAHKAN. Seluruh unggahan selama ini ditulis ke folder
 * `uploads/` di disk mesin. Folder itu ada di .gitignore dan TIDAK ikut antar
 * lingkungan. Di platform serverless seperti Vercel, sistem berkasnya bersifat
 * sementara: setiap deploy memulai dari nol, dan setiap instance punya disknya
 * sendiri. Artinya di produksi seluruh foto profil dan lampiran akan HILANG
 * pada deploy berikutnya, sementara baris di database tetap menunjuk berkas
 * yang sudah tidak ada.
 *
 * Kondisi itu sudah terbukti di repo ini: satu akun ditemukan memiliki
 * avatar_url yang menunjuk berkas tidak eksis.
 *
 * PILIHAN DESAIN. Driver dipilih dari environment, BUKAN dari kode:
 *
 *   STORAGE_DRIVER=local  (bawaan)  disk, seperti sekarang — dev tetap jalan
 *   STORAGE_DRIVER=s3                S3, Cloudflare R2, MinIO, atau sejenisnya
 *
 * Dengan begitu pengembangan lokal tidak butuh kredensial apa pun, dan
 * produksi cukup mengisi environment tanpa mengubah satu baris kode.
 *
 * Bila STORAGE_DRIVER=s3 tetapi konfigurasinya tidak lengkap, modul ini
 * MELEMPAR saat dimuat. Itu disengaja: konfigurasi penyimpanan yang salah
 * harus gagal secara terbuka sejak awal, bukan diam-diam menulis ke disk
 * sementara lalu kehilangan berkas pengguna berhari-hari kemudian.
 */
import fs from "fs";
import path from "path";
import { GLOBAL_UPLOADS_DIR } from "../config/uploads";

export type DriverPenyimpanan = "local" | "s3";

export const DRIVER: DriverPenyimpanan =
  (process.env.STORAGE_DRIVER as DriverPenyimpanan) || "local";

const S3_BUCKET = process.env.STORAGE_BUCKET || "";
const S3_REGION = process.env.STORAGE_REGION || "auto";
const S3_ENDPOINT = process.env.STORAGE_ENDPOINT || "";
const S3_PUBLIC_URL = process.env.STORAGE_PUBLIC_URL || "";

if (DRIVER === "s3" && (!S3_BUCKET || !process.env.STORAGE_ACCESS_KEY_ID)) {
  throw new Error(
    "[STORAGE] STORAGE_DRIVER=s3 tetapi STORAGE_BUCKET atau STORAGE_ACCESS_KEY_ID belum diisi. " +
      "Konfigurasi penyimpanan yang tidak lengkap harus gagal sekarang, bukan setelah berkas pengguna hilang."
  );
}

/** Klien S3 dibuat malas: proyek yang memakai driver lokal tidak perlu memuatnya. */
let klienS3: any = null;
async function ambilKlien() {
  if (klienS3) return klienS3;
  const { S3Client } = await import("@aws-sdk/client-s3");
  klienS3 = new S3Client({
    region: S3_REGION,
    ...(S3_ENDPOINT ? { endpoint: S3_ENDPOINT, forcePathStyle: true } : {}),
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY || "",
    },
  });
  return klienS3;
}

/**
 * Menyimpan berkas dan mengembalikan URL yang bisa disimpan di database.
 *
 * Bentuk URL sengaja dibuat sama untuk kedua driver (`/uploads/<nama>` pada
 * driver lokal), sehingga baris database yang sudah ada tetap sah dan tidak
 * perlu migrasi data saat berpindah driver.
 */
export async function simpanBerkas(
  namaBerkas: string,
  isi: Buffer,
  tipeKonten?: string
): Promise<string> {
  if (DRIVER === "s3") {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const klien = await ambilKlien();
    await klien.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: namaBerkas,
        Body: isi,
        ContentType: tipeKonten,
      })
    );
    return S3_PUBLIC_URL
      ? `${S3_PUBLIC_URL.replace(/\/$/, "")}/${namaBerkas}`
      : `/uploads/${namaBerkas}`;
  }

  if (!fs.existsSync(GLOBAL_UPLOADS_DIR)) {
    fs.mkdirSync(GLOBAL_UPLOADS_DIR, { recursive: true });
  }
  fs.writeFileSync(path.join(GLOBAL_UPLOADS_DIR, namaBerkas), isi);
  return `/uploads/${namaBerkas}`;
}

/**
 * Menghapus berkas. Kegagalan TIDAK dilempar.
 *
 * Penghapusan selalu merupakan pembersihan setelah operasi utama berhasil;
 * menggagalkan permintaan hanya karena berkas lama tak terhapus akan merugikan
 * pengguna tanpa alasan.
 */
export async function hapusBerkas(namaBerkas: string): Promise<void> {
  try {
    if (DRIVER === "s3") {
      const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      const klien = await ambilKlien();
      await klien.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: namaBerkas }));
      return;
    }
    const jalur = path.join(GLOBAL_UPLOADS_DIR, namaBerkas);
    // Pastikan hasil join masih di dalam direktori unggahan.
    if (!jalur.startsWith(GLOBAL_UPLOADS_DIR)) return;
    if (fs.existsSync(jalur)) fs.unlinkSync(jalur);
  } catch (err) {
    console.warn("[STORAGE] Gagal menghapus berkas:", namaBerkas, err);
  }
}

/** Ringkasan konfigurasi untuk keperluan diagnostik (tanpa kredensial). */
export function ringkasanPenyimpanan() {
  return {
    driver: DRIVER,
    bucket: DRIVER === "s3" ? S3_BUCKET : GLOBAL_UPLOADS_DIR,
    endpoint: DRIVER === "s3" ? S3_ENDPOINT || "(bawaan AWS)" : "(disk lokal)",
    persisten: DRIVER === "s3",
  };
}
