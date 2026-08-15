import React from 'react';
import { cn } from '../../lib/utils';
import { UserAvatar } from '../../components/ui/UserAvatar';

interface UserBadgeProps {
  authorId: string;
  users: any[];
  className?: string;
  showRole?: boolean;
  showName?: boolean;
}

export const UserBadge = ({ authorId, users = [], className, showRole = false, showName = true }: UserBadgeProps) => {
  const getAuthorDisplay = (id: string, memberList: any[]) => {
    const list = Array.isArray(memberList) ? memberList : [];
    const user = list.find(u => 
      u && (
        (u.uid && String(u.uid) === String(id)) || 
        (u.id && String(u.id) === String(id)) || 
        (u.username && String(u.username) === String(id)) ||
        (u.email && String(u.email) === String(id))
      )
    );
    if (!user) {
      if (id === 'admin') return { name: 'Admin Manager', isSystem: true, role: 'admin', userObj: null };
      return { name: id || 'Unknown', isSystem: false, role: 'member', userObj: null };
    }
    const name = user.displayName || user.nama_lengkap || user.name || user.username || 'User';
    return { name, isSystem: false, role: user.role, userObj: user };
  };

  const { name, role, userObj } = getAuthorDisplay(authorId, users);

  return (
    <div 
      className={cn("inline-flex items-center gap-2 max-w-full text-left group/avatar relative cursor-pointer", className)}
      title={name}
    >
      <UserAvatar
        user={userObj}
        uid={authorId}
        members={users}
        name={name}
        className="w-6 h-6 text-xs sm:text-[11px] sm:text-[9px] shrink-0 group-hover/avatar:scale-110 transition-transform"
      />
      {showName && (
        <div className="flex flex-col min-w-0">
          <span className="truncate text-xs font-medium text-content-body leading-tight">
            {name}
          </span>
          {showRole && role && (
            <span className="text-xs sm:text-[11px] sm:text-[9px] font-medium text-content-subtle uppercase tracking-wider leading-none mt-0.5">
              {role}
            </span>
          )}
        </div>
      )}

      {/* Floating Hover Tooltip (NAME ONLY) */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/avatar:flex flex-col items-center z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-slate-900 text-white px-2.5 py-1 rounded-lg text-xs sm:text-[10px] font-medium whitespace-nowrap shadow-xl border border-slate-800">
          <span>{name}</span>
        </div>
        <div className="w-2 h-2 bg-slate-900 rotate-45 -mt-1"></div>
      </div>
    </div>
  );
};
