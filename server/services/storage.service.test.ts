/**
 * Test lapisan penyimpanan berkas — driver lokal.
 *
 * Driver s3 TIDAK diuji di sini karena membutuhkan kredensial dan bucket
 * sungguhan. Yang diuji adalah kontrak yang dipakai seluruh pemanggil:
 * berkas tersimpan, URL yang dikembalikan berbentuk sama, penghapusan bekerja,
 * dan kegagalan penghapusan tidak melempar.
 */
import fs from "fs";
import path from "path";
import {
  simpanBerkas,
  hapusBerkas,
  bacaBerkas,
  adaBerkas,
  ringkasanPenyimpanan,
  DRIVER,
} from "./storage.service";
import { GLOBAL_UPLOADS_DIR } from "../config/uploads";

const NAMA = `uji-storage-${Date.now()}.png`;
const ISI = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

describe("storage.service — driver lokal", () => {
  afterAll(() => {
    const j = path.join(GLOBAL_UPLOADS_DIR, NAMA);
    if (fs.existsSync(j)) fs.unlinkSync(j);
  });

  it("memakai driver lokal bila STORAGE_DRIVER tidak diisi", () => {
    expect(DRIVER).toBe("local");
    expect(ringkasanPenyimpanan().persisten).toBe(false);
  });

  it("menyimpan berkas ke disk dan mengembalikan URL /uploads/", async () => {
    const url = await simpanBerkas(NAMA, ISI, "image/png");

    expect(url).toBe(`/uploads/${NAMA}`);
    expect(fs.existsSync(path.join(GLOBAL_UPLOADS_DIR, NAMA))).toBe(true);
    expect(fs.readFileSync(path.join(GLOBAL_UPLOADS_DIR, NAMA))).toEqual(ISI);
  });

  it("menghapus berkas yang ada", async () => {
    await simpanBerkas(NAMA, ISI, "image/png");
    expect(fs.existsSync(path.join(GLOBAL_UPLOADS_DIR, NAMA))).toBe(true);

    await hapusBerkas(NAMA);
    expect(fs.existsSync(path.join(GLOBAL_UPLOADS_DIR, NAMA))).toBe(false);
  });

  it("tidak melempar saat berkas yang dihapus tidak ada", async () => {
    await expect(hapusBerkas("berkas-yang-tidak-pernah-ada.png")).resolves.toBeUndefined();
  });

  it("membaca kembali isi berkas yang disimpan", async () => {
    await simpanBerkas(NAMA, ISI, "image/png");

    expect(await bacaBerkas(NAMA)).toEqual(ISI);
    expect(await adaBerkas(NAMA)).toBe(true);
  });

  it("mengembalikan null untuk berkas yang tidak ada, bukan melempar", async () => {
    expect(await bacaBerkas("tidak-pernah-ada.png")).toBeNull();
    expect(await adaBerkas("tidak-pernah-ada.png")).toBe(false);
  });

  it("menolak keluar dari direktori unggahan saat membaca", async () => {
    // Jalur unduh dokumen memakai fungsi ini; kebocoran di sini berarti isi
    // berkas apa pun di server bisa ditarik lewat parameter permintaan.
    expect(await bacaBerkas("../../.env")).toBeNull();
    expect(await adaBerkas("../../package.json")).toBe(false);
  });

  it("menolak keluar dari direktori unggahan saat menghapus", async () => {
    // Tidak boleh melempar, dan tidak boleh menyentuh apa pun di luar uploads/.
    await expect(hapusBerkas("../../.env")).resolves.toBeUndefined();
    expect(fs.existsSync(path.join(process.cwd(), ".env"))).toBe(true);
  });
});
