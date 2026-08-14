import { useAuthStore } from '../stores';

export const useAuthState = () => {
  return useAuthStore((state) => ({
    isLoggedIn: state.isLoggedIn,
    currentUser: state.currentUser,
    userRole: state.userRole,
    currentUserProfile: state.currentUserProfile,
    authView: state.authView,
    showCollisionModal: state.showCollisionModal,
    activeSessionData: state.activeSessionData,
    pendingLoginCredentials: state.pendingLoginCredentials,
    isAuthLoading: state.isAuthLoading,
    loginStatusText: state.loginStatusText,
    effectiveRole: state.effectiveRole,
  }));
};

export const useAuthActions = () => {
  return useAuthStore((state) => ({
    setIsLoggedIn: state.setIsLoggedIn,
    setCurrentUser: state.setCurrentUser,
    setUserRole: state.setUserRole,
    setCurrentUserProfile: state.setCurrentUserProfile,
    setAuthView: state.setAuthView,
    setShowCollisionModal: state.setShowCollisionModal,
    setActiveSessionData: state.setActiveSessionData,
    setPendingLoginCredentials: state.setPendingLoginCredentials,
    setIsAuthLoading: state.setIsAuthLoading,
    setLoginStatusText: state.setLoginStatusText,
    setEffectiveRole: state.setEffectiveRole,
    clearAuth: state.clearAuth,
  }));
};

export const useAuth = () => ({
  ...useAuthState(),
  ...useAuthActions(),
});
