import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { UserProfile } from '../../types';

export const getUserAvatarColors = (idOrName: string = '') => {
  const colors = [
    { bg: 'bg-blue-100 dark:bg-blue-950/60', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
    { bg: 'bg-emerald-100 dark:bg-emerald-950/60', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
    { bg: 'bg-violet-100 dark:bg-violet-950/60', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-200 dark:border-violet-800' },
    { bg: 'bg-amber-100 dark:bg-amber-950/60', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
    { bg: 'bg-rose-100 dark:bg-rose-950/60', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800' },
    { bg: 'bg-indigo-100 dark:bg-indigo-950/60', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-800' },
    { bg: 'bg-cyan-100 dark:bg-cyan-950/60', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-200 dark:border-cyan-800' },
    { bg: 'bg-fuchsia-100 dark:bg-fuchsia-950/60', text: 'text-fuchsia-700 dark:text-fuchsia-300', border: 'border-fuchsia-200 dark:border-fuchsia-800' },
  ];
  
  let hash = 0;
  const target = idOrName || '';
  for (let i = 0; i < target.length; i++) {
    hash = target.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

export const getInitials = (fullName?: string): string => {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export interface UserAvatarProps {
  user?: UserProfile | any;
  uid?: string;
  members?: UserProfile[] | any[];
  name?: string;
  src?: string;
  avatar_url?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | string;
  onClick?: (e: React.MouseEvent) => void;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ 
  user, 
  uid, 
  members, 
  name, 
  src, 
  avatar_url, 
  className,
  size,
  onClick 
}) => {
  const [imgError, setImgError] = useState(false);

  // 1. Resolve user entity or member from members list
  const memberList = Array.isArray(members) ? members : [];
  const member = user || (memberList.length > 0 && uid ? memberList.find((m: any) => 
    m && (
      (m.uid && String(m.uid) === String(uid)) || 
      (m.id && String(m.id) === String(uid)) ||
      (m.username && String(m.username) === String(uid)) ||
      (m.email && String(m.email) === String(uid))
    )
  ) : undefined);

  // 2. Resolve display name
  const displayName = name || member?.displayName || member?.nama_lengkap || member?.name || member?.username || member?.email || 'User';

  // 3. Resolve avatar URL (supports avatar_url, photoURL, avatarUrl, avatar, src)
  const resolvedAvatarUrl = src || avatar_url || member?.avatar_url || member?.photoURL || member?.avatarUrl || member?.avatar || (user as any)?.photoUrl;

  // Reset imgError if avatar URL changes
  useEffect(() => {
    setImgError(false);
  }, [resolvedAvatarUrl]);

  const targetId = member?.id || member?.uid || uid || displayName;
  const colors = getUserAvatarColors(String(targetId));

  const sizeClasses: Record<string, string> = {
    xs: 'w-5 h-5 text-[9px]',
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
    xl: 'w-16 h-16 text-xl'
  };

  const defaultSizeClass = size && sizeClasses[size] ? sizeClasses[size] : 'w-6 h-6 text-[10px]';

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-full flex items-center justify-center font-semibold overflow-hidden shrink-0 select-none transition-all border shadow-2xs",
        colors.bg,
        colors.text,
        colors.border,
        defaultSizeClass,
        className
      )}
      title={displayName}
    >
      {resolvedAvatarUrl && !imgError ? (
        <img
          src={resolvedAvatarUrl}
          alt={displayName}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="leading-none">{getInitials(displayName)}</span>
      )}
    </div>
  );
};

export default UserAvatar;
