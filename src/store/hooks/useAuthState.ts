import { useAuthStore } from '../stores';

/**
 * Setiap nilai diambil lewat selector atomik yang terpisah.
 *
 * Sebelumnya hook ini memakai satu selector yang mengembalikan objek literal.
 * Di Zustand v5 objek baru pada tiap pemanggilan dianggap sebagai snapshot yang
 * selalu berubah, sehingga React me-render ulang tanpa henti
 * ("Maximum update depth exceeded"). Selector atomik mengembalikan referensi
 * yang stabil, jadi render ulang hanya terjadi saat nilainya benar-benar berubah.
 */
export const useAuthState = () => ({
  isLoggedIn: useAuthStore((s) => s.isLoggedIn),
  currentUser: useAuthStore((s) => s.currentUser),
  userRole: useAuthStore((s) => s.userRole),
  currentUserProfile: useAuthStore((s) => s.currentUserProfile),
  authView: useAuthStore((s) => s.authView),
  showCollisionModal: useAuthStore((s) => s.showCollisionModal),
  activeSessionData: useAuthStore((s) => s.activeSessionData),
  pendingLoginCredentials: useAuthStore((s) => s.pendingLoginCredentials),
  isAuthLoading: useAuthStore((s) => s.isAuthLoading),
  loginStatusText: useAuthStore((s) => s.loginStatusText),
  effectiveRole: useAuthStore((s) => s.effectiveRole),
});

export const useAuthActions = () => ({
  setIsLoggedIn: useAuthStore((s) => s.setIsLoggedIn),
  setCurrentUser: useAuthStore((s) => s.setCurrentUser),
  setUserRole: useAuthStore((s) => s.setUserRole),
  setCurrentUserProfile: useAuthStore((s) => s.setCurrentUserProfile),
  setAuthView: useAuthStore((s) => s.setAuthView),
  setShowCollisionModal: useAuthStore((s) => s.setShowCollisionModal),
  setActiveSessionData: useAuthStore((s) => s.setActiveSessionData),
  setPendingLoginCredentials: useAuthStore((s) => s.setPendingLoginCredentials),
  setIsAuthLoading: useAuthStore((s) => s.setIsAuthLoading),
  setLoginStatusText: useAuthStore((s) => s.setLoginStatusText),
  setEffectiveRole: useAuthStore((s) => s.setEffectiveRole),
  clearAuth: useAuthStore((s) => s.clearAuth),
});

export const useAuth = () => ({
  ...useAuthState(),
  ...useAuthActions(),
});
