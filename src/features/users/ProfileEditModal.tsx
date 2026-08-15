import React, { useState, useEffect } from "react";
import { User, Mail, Phone, Lock, Eye, EyeOff, Loader2, Save } from "lucide-react";
import { Button, Input } from "../../components/ui/CoreUI";
import { uploadAvatar, updateProfile } from "./services/users.service";
import { Modal } from "../../components/ui/Modal";
import { UserAvatar } from "./styles";
import { UserProfile } from "../../types/user";
import { toast } from "sonner";

export const ProfileEditModal = ({
  isOpen,
  onClose,
  userProfile,
  onProfileUpdated,
}: {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  onProfileUpdated?: (updatedProfile: Partial<UserProfile>) => void;
}) => {
  const [selectedAvatar, setSelectedAvatar] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(
    userProfile?.displayName || "",
  );
  const [username, setUsername] = useState(userProfile?.username || "");
  const [email, setEmail] = useState(userProfile?.email || "");
  const [phone, setPhone] = useState(userProfile?.phone || "");
  const [photoURL, setPhotoURL] = useState(userProfile?.photoURL || "");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (isOpen) {
      setDisplayName(userProfile?.displayName || "");
      setUsername(userProfile?.username || "");
      setEmail(userProfile?.email || "");
      setPhone(userProfile?.phone || "");
      setPhotoURL(userProfile?.photoURL || "");
      setSelectedAvatar(null);
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
    }
  }, [isOpen, userProfile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Format file tidak didukung (gunakan JPG, PNG, WEBP, GIF, atau SVG)');
      return;
    }
    
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error('Ukuran file maksimal 5MB');
      return;
    }

    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedAvatar(file);
    setPreviewUrl(objectUrl);
  };

  const handleUpdateProfile = async () => {
    const docId = userProfile?.id || userProfile?.uid;
    if (!docId) return;
    setLoading(true);
    setError(null);
    try {
      let finalPhotoURL = photoURL;

      if (selectedAvatar) {
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', selectedAvatar);

        const uploadData = await uploadAvatar(docId, formData);

        if (uploadData && (uploadData.status === 'success' || uploadData.avatar_url)) {
          finalPhotoURL = uploadData.avatar_url || uploadData.data?.avatar_url || uploadData.data?.photoURL || finalPhotoURL;
          setPhotoURL(finalPhotoURL);

          // Preview blob DITAHAN sampai gambar dari server benar-benar termuat.
          //
          // Sebelumnya blob langsung di-revoke begitu URL server dipasang,
          // sehingga di jeda pemuatan jaringan avatar berkedip ke inisial nama.
          // Menunggu onload membuat pergantiannya mulus: blob baru dilepas
          // setelah penggantinya siap digambar.
          //
          // Batas 3 detik mencegah modal menggantung bila gambar gagal dimuat;
          // onerror juga menyelesaikan penantian karena preview yang tertinggal
          // lebih baik daripada antarmuka yang membeku.
          const blobLama = previewUrl;
          await new Promise<void>((selesai) => {
            const img = new Image();
            const batas = setTimeout(selesai, 3000);
            const rampung = () => { clearTimeout(batas); selesai(); };
            img.onload = rampung;
            img.onerror = rampung;
            img.src = finalPhotoURL;
          });

          if (blobLama && blobLama.startsWith('blob:')) {
            URL.revokeObjectURL(blobLama);
          }
          setPreviewUrl(null);
          setSelectedAvatar(null);
        } else {
          toast.error(uploadData?.message || 'Gagal mengunggah foto avatar.');
          setLoading(false);
          setIsUploading(false);
          return;
        }
        setIsUploading(false);
      }

      await updateProfile({
        displayName,
        username,
        email,
        phone,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
        photoURL: finalPhotoURL,
        avatar_url: finalPhotoURL,
      });

      if (onProfileUpdated) {
        // KETIGA kunci avatar dikirim. Basis data menyimpan nilai yang sama di
        // avatar_url, photoURL, dan avatarUrl, dan komponen yang berbeda membaca
        // kunci yang berbeda. Mengirim sebagian saja meninggalkan kunci basi di
        // state induk — pemakai yang membaca kunci itu tetap menampilkan foto
        // lama sampai halaman dimuat ulang.
        onProfileUpdated({
          displayName,
          username,
          email,
          phone,
          photoURL: finalPhotoURL,
          avatar_url: finalPhotoURL,
          avatarUrl: finalPhotoURL,
        });
      }

      toast.success("Profile updated successfully.");
      onClose();
    } catch (error: any) {
      console.error("Error updating profile", error);
      const errorMessage = error.message || "Failed to update profile";
      if (errorMessage === "Password lama yang Anda masukkan salah!") {
        setError(errorMessage);
      } else {
        toast.error(`Failed to update profile: ${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Profil">
      <div className="space-y-6">
        <div className="flex gap-4 items-center bg-surface-sunken p-4 rounded-xl border border-border-faint relative">
          <div className="relative group cursor-pointer">
            {/* Ketiga kunci avatar WAJIB ditimpa sekaligus, bukan photoURL saja.
                UserAvatar meresolusi sumber gambar dengan urutan
                avatar_url -> photoURL -> avatarUrl, sehingga menimpa photoURL
                saja membuat avatar_url LAMA dari spread userProfile tetap
                menang — preview menampilkan foto lama meski berkas baru sudah
                dipilih. Itu gejala yang dilaporkan dari penggunaan nyata.

                `key` memaksa elemen dibuat ulang saat sumber berubah, supaya
                status galat gambar sebelumnya tidak terbawa. */}
            <UserAvatar
              key={previewUrl || photoURL || 'kosong'}
              user={{
                ...userProfile,
                displayName,
                username,
                avatar_url: previewUrl || photoURL,
                photoURL: previewUrl || photoURL,
                avatarUrl: previewUrl || photoURL,
              } as any}
              className="w-16 h-16 text-2xl"
            />
            {previewUrl && (
              <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-xs sm:text-[11px] sm:text-[9px] font-semibold px-2 py-0.5 rounded-full shadow-xs whitespace-nowrap z-20">
                Pratinjau
              </span>
            )}
            <label className="absolute inset-0 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
              <span className="text-xs sm:text-[10px] font-medium uppercase tracking-wider">{isUploading ? '...' : 'Pilih Foto'}</span>
              <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={isUploading || loading} />
            </label>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-content-strong">
              {displayName}
            </p>
            <p className="text-xs text-content-muted">{email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-content-muted uppercase tracking-wider">
              Nama Lengkap
            </label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-content-muted uppercase tracking-wider">
              Username
            </label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="block text-xs font-medium text-content-muted uppercase tracking-wider">
              Email
            </label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="block text-xs font-medium text-content-muted uppercase tracking-wider">
              Nomor Telepon
            </label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>

        <div className="pt-4 border-t border-border-faint space-y-3">
          <h4 className="text-sm font-medium text-content-strong">Ubah Password</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 relative">
              <label className="block text-xs font-medium text-content-muted uppercase tracking-wider">
                Password Lama
              </label>
              <Input
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  setError(null);
                }}
                placeholder="••••••••"
                className="pr-10"
              />
              {error && <p className="text-xs sm:text-[10px] text-red-500 font-medium">{error}</p>}
              <button
                type="button"
                className="absolute right-3 top-8 text-content-subtle hover:text-content-secondary"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="space-y-1 relative">
              <label className="block text-xs font-medium text-content-muted uppercase tracking-wider">
                Password Baru
              </label>
              <Input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-8 text-content-subtle hover:text-content-secondary"
                onClick={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleUpdateProfile}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 font-medium transition-all disabled:opacity-50"
        >
          {loading ? (
            "Saving..."
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Changes
            </>
          )}
        </button>
      </div>
    </Modal>
  );
};


