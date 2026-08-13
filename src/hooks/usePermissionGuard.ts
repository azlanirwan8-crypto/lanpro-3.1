import { safeLocalStorage, safeSessionStorage } from "../lib/safeStorage";
import { hasPermission } from '../lib/permissions';
import { UserProfile } from '../types';

export const usePermissionGuard = (
    module: string,
    action: 'create' | 'read' | 'update' | 'delete',
    isOwner: boolean = false
): boolean => {
    const sessionStr = typeof window !== 'undefined' 
        ? (safeSessionStorage.getItem("sessionUser") || safeLocalStorage.getItem("sessionUser"))
        : null;
        
    if (!sessionStr) return false;
    
    try {
        const currentUserProfile: UserProfile = JSON.parse(sessionStr);
        if (!currentUserProfile) return false;
        
        const permissions = typeof currentUserProfile.permissions === 'string'
            ? JSON.parse(currentUserProfile.permissions)
            : currentUserProfile.permissions;

        return hasPermission(
            currentUserProfile.role,
            module as any,
            action,
            isOwner,
            permissions as any
        );
    } catch (e) {
        return false;
    }
};
