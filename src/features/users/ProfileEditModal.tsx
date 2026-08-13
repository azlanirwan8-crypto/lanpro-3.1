import React, { useState, useEffect } from "react";
import { User, Mail, Phone, Lock, Eye, EyeOff, Loader2, Save } from "lucide-react";
import { Button, Input } from "../../components/ui/CoreUI";
import { apiRequest } from "../../lib/api";
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
    if (isOpen) {
      setDisplayName(userProfile?.displayName || "");
      setUsername(userProfile?.username || "");
      setEmail(userProfile?.email || "");
      setPhone(userProfile?.phone || "");
      setPhotoURL(userProfile?.photoURL || "");
    }
  }, [isOpen, userProfile]);

  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Format file tidak didukung (gunakan JPG, PNG, atau WEBP)');
      return;
    }
    
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      toast.error('Ukuran file maksimal 2MB');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    try {
      const token = localStorage.getItem('lanpro_jwt_token');
      const res = await fetch('/api/v1/upload-document', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.status === 'success') {
        setPhotoURL(data.data.protectedUrl || data.data.url);
        toast.success('Foto berhasil diunggah');
      } else {
        toast.error(data.message || 'Gagal mengunggah foto');
      }
    } catch (err) {
      toast.error('Terjadi kesalahan jaringan');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdateProfile = async () => {
    const docId = userProfile?.id || userProfile?.uid;
    if (!docId) return;
    setLoading(true);
    setError(null);
    try {
      await apiRequest(`/api/profile/update`, {
        method: "PUT",
        body: { 
          displayName, 
          username, 
          email, 
          phone, 
          currentPassword: currentPassword || undefined, 
          newPassword: newPassword || undefined,
          photoURL 
        },
      });

      if (onProfileUpdated) {
        onProfileUpdated({
          displayName,
          username,
          email,
          phone,
          photoURL,
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
        <div className="flex gap-4 items-center bg-slate-50 p-4 rounded-xl border border-slate-100 relative">
          <div className="relative group cursor-pointer">
            <UserAvatar user={{ ...userProfile, displayName, username, photoURL } as any} className="w-16 h-16 text-2xl" />
            <label className="absolute inset-0 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
              <span className="text-[10px] font-medium uppercase tracking-wider">{isUploading ? '...' : 'Upload'}</span>
              <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={isUploading} />
            </label>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-800">
              {displayName}
            </p>
            <p className="text-xs text-slate-500">{email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">
              Nama Lengkap
            </label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">
              Username
            </label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">
              Email
            </label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">
              Nomor Telepon
            </label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 space-y-3">
          <h4 className="text-sm font-medium text-slate-800">Ubah Password</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 relative">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">
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
              {error && <p className="text-[10px] text-red-500 font-medium">{error}</p>}
              <button
                type="button"
                className="absolute right-3 top-8 text-slate-400 hover:text-slate-600"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="space-y-1 relative">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">
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
                className="absolute right-3 top-8 text-slate-400 hover:text-slate-600"
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


