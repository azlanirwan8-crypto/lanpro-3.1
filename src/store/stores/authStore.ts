import { create } from 'zustand';
import { UserProfile, AppRole } from '../../types';

interface AuthState {
  // Auth state
  isLoggedIn: boolean;
  currentUser: UserProfile | null;
  userRole: AppRole | null;
  currentUserProfile: UserProfile | null;

  // Auth view
  authView: 'login' | 'register';

  // Session
  showCollisionModal: boolean;
  activeSessionData: any;
  pendingLoginCredentials: any;

  // Loading
  isAuthLoading: boolean;
  loginStatusText: string;

  // Computed
  effectiveRole: AppRole;

  // Actions
  setIsLoggedIn: (value: boolean) => void;
  setCurrentUser: (user: UserProfile | null) => void;
  setUserRole: (role: AppRole | null) => void;
  setCurrentUserProfile: (profile: UserProfile | null) => void;
  setAuthView: (view: 'login' | 'register') => void;
  setShowCollisionModal: (show: boolean) => void;
  setActiveSessionData: (data: any) => void;
  setPendingLoginCredentials: (creds: any) => void;
  setIsAuthLoading: (loading: boolean) => void;
  setLoginStatusText: (text: string) => void;
  setEffectiveRole: (role: AppRole) => void;

  // Clear all auth
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  // Initial state
  isLoggedIn: false,
  currentUser: null,
  userRole: null,
  currentUserProfile: null,
  authView: 'login',
  showCollisionModal: false,
  activeSessionData: null,
  pendingLoginCredentials: null,
  isAuthLoading: false,
  loginStatusText: 'Authenticating...',
  effectiveRole: 'user',

  // Setters
  setIsLoggedIn: (value) => set({ isLoggedIn: value }),
  setCurrentUser: (user) => set({ currentUser: user }),
  setUserRole: (role) => set({ userRole: role }),
  setCurrentUserProfile: (profile) => set({ currentUserProfile: profile }),
  setAuthView: (view) => set({ authView: view }),
  setShowCollisionModal: (show) => set({ showCollisionModal: show }),
  setActiveSessionData: (data) => set({ activeSessionData: data }),
  setPendingLoginCredentials: (creds) => set({ pendingLoginCredentials: creds }),
  setIsAuthLoading: (loading) => set({ isAuthLoading: loading }),
  setLoginStatusText: (text) => set({ loginStatusText: text }),
  setEffectiveRole: (role) => set({ effectiveRole: role }),

  // Clear auth
  clearAuth: () => set({
    isLoggedIn: false,
    currentUser: null,
    userRole: null,
    currentUserProfile: null,
    authView: 'login',
    showCollisionModal: false,
    activeSessionData: null,
    pendingLoginCredentials: null,
    isAuthLoading: false,
    loginStatusText: 'Authenticating...',
  }),
}));
