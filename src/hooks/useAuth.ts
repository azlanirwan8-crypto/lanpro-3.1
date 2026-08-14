import { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import type { AppView } from '../store/useAppStore';
import Swal from 'sweetalert2';
import {
  UserProfile,
  AppRole,
} from '../types';
import {
  apiRequest,
  ApiError,
  setAuthToken,
  clearAuthToken,
  getAuthToken,
} from '../lib/api';
import {
  safeLocalStorage,
  safeSessionStorage,
} from '../lib/safeStorage';

// Browser session ID for collision detection
const BROWSER_SESSION_ID = typeof window !== 'undefined' ? window.sessionStorage.getItem('browserSessionId') ||
  (() => {
    const id = Math.random().toString(36).slice(2);
    window.sessionStorage.setItem('browserSessionId', id);
    return id;
  })() : '';

interface UseAuthReturn {
  isLoggedIn: boolean;
  currentUser: UserProfile | null;
  userRole: AppRole | null;
  currentUserProfile: UserProfile | null;
  authView: 'login' | 'register';
  setAuthView: (view: 'login' | 'register') => void;
  socket: any;
  setSocket: (socket: any) => void;
  showCollisionModal: boolean;
  activeSessionData: any;
  pendingLoginCredentials: any;
  isAuthLoading: boolean;
  loginStatusText: string;
  setLoginStatusText: (text: string) => void;
  effectiveRole: AppRole;
  handleLogout: (silent?: boolean) => Promise<void>;
  handleLogoutRequest: () => void;
  handleManualLogin: (username: string, password: string, remember: boolean, force?: boolean) => Promise<void>;
  handleRegister: (username: string, password: string, name: string, email: string) => Promise<{ success: boolean; message?: string }>;

  // State auth dimiliki hook ini. Setter-setter di bawah diekspos karena
  // AppContainer memakainya langsung (mis. saat update profil dan penanganan
  // sesi ganda). Tanpa ini AppContainer merujuk nama yang tidak terdefinisi.
  setIsLoggedIn: (value: boolean) => void;
  setCurrentUser: (user: any) => void;
  setUserRole: (role: AppRole | null) => void;
  setCurrentUserProfile: (profile: any) => void;
  setShowCollisionModal: (show: boolean) => void;
  setPendingLoginCredentials: (creds: any) => void;
  fetchAllUsers: () => Promise<void>;
}

export function useAuth(
  setSelectedProject?: (project: any) => void,
  setProjects?: (projects: any[]) => void,
  setTasks?: (tasks: any[]) => void,
  setSprints?: (sprints: any[]) => void,
  setProjectMembers?: (members: any[]) => void,
  setActivityLogs?: (logs: any[]) => void,
  setCurrentView?: (view: AppView) => void,
  setAllUsers?: (users: UserProfile[]) => void,
  setNewTaskStatus?: (status: string) => void,
  setNewTaskPriority?: (priority: string) => void,
  setMasterData?: (data: any[]) => void,
  setConfirmAction?: (action: any) => void,
): UseAuthReturn {
  const handleAuthApiResponse = (status: number, data: any) => {
    if (status === 429) {
      toast.error('Terlalu banyak percobaan. Silakan tunggu beberapa menit.');
    } else if (status === 401) {
      toast.error(data?.message || 'Username atau password salah.');
    } else {
      toast.error(data?.message || 'Terjadi kesalahan saat login.');
    }
  };

  // Auth States
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [socket, setSocket] = useState<any>(null);
  const [showCollisionModal, setShowCollisionModal] = useState(false);
  const [activeSessionData, setActiveSessionData] = useState<any>(null);
  const [pendingLoginCredentials, setPendingLoginCredentials] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [loginStatusText, setLoginStatusText] = useState<string>('Authenticating...');

  // Effective role calculation
  const user: any = currentUser;
  const effectiveRole = useMemo(() => {
    const usernameLower = (
      currentUser?.username ||
      currentUserProfile?.username ||
      user?.username ||
      ''
    )
      .toLowerCase()
      .trim();
    const roleLower = (userRole || currentUser?.role || currentUserProfile?.role || '')
      .toLowerCase()
      .trim();

    if (
      usernameLower === 'admin' ||
      roleLower === 'admin' ||
      roleLower === 'administrator' ||
      roleLower === 'superadmin'
    )
      return 'admin';

    return (userRole || 'user') as AppRole;
  }, [userRole, currentUser?.uid, currentUser?.role, currentUser?.username, currentUserProfile?.username]);

  // Fetch all users
  const fetchAllUsers = async () => {
    if (!isLoggedIn || !getAuthToken()) return;
    try {
      const data = await apiRequest('/api/users');
      if (data.status === 'success') {
        setAllUsers(data.data as UserProfile[]);
      }
    } catch (error) {
      console.warn('Silent failure fetching all users:', error);
    }
  };

  // Logout handler
  const handleLogout = async (silent = false) => {
    const wasLoggedIn = isLoggedIn || !!currentUser || !!safeLocalStorage.getItem('lanpro_jwt_token');
    const activeUserId = currentUser?.id || currentUser?.uid;

    if (activeUserId) {
      try {
        await apiRequest('/api/auth/logout', {
          method: 'POST',
          body: { userId: activeUserId },
        }).catch(() => {
          // Ignore network or API errors on logout to allow local session clearance
        });
      } catch (e) {
        // Silently ignore logout network exceptions
      }
    }

    safeLocalStorage.removeItem('isAdminMode');
    safeLocalStorage.removeItem('sessionUser');
    safeSessionStorage.removeItem('sessionUser');
    clearAuthToken();

    if (socket) {
      socket.emit('leave_presence');
    }

    // Clear all significant states
    setCurrentUserProfile(null);
    setCurrentUser(null);
    setIsLoggedIn(false);
    setSelectedProject?.(null);
    setProjects?.([]);
    setTasks?.([]);
    setSprints?.([]);
    setProjectMembers?.([]);
    setActivityLogs?.([]);
    setCurrentView?.('dashboard');
    setAuthView('login');

    if (wasLoggedIn && !silent) {
      toast.success('Logged out successfully');
    }

    // Hard check to ensure we are back at login if state doesn't trigger immediately
    setTimeout(() => {
      if (window.location.hash !== '' || window.location.search !== '') {
        window.location.href = window.location.origin;
      }
    }, 500);
  };

  // Logout request with confirmation
  const handleLogoutRequest = () => {
    setConfirmAction?.({
      isOpen: true,
      title: 'Logout Akun',
      message: 'Apakah Anda yakin ingin keluar dari LanPro? Sesi Anda akan diakhiri.',
      variant: 'warning',
      confirmText: 'Ya, Keluar',
      cancelText: 'Batal',
      onConfirm: async () => {
        await handleLogout(false);
      },
    });
  };

  // Manual login handler
  const handleManualLogin = async (
    username: string,
    password: string,
    remember: boolean,
    force: boolean = false,
  ) => {
    if (!username || !password) {
      toast.error('Username/Email dan Password wajib diisi.');
      return;
    }
    if (isAuthLoading && !force) return;

    try {
      setIsAuthLoading(true);
      setLoginStatusText('Authenticating...');

      // Special Hardcoded Admin bypass
      if (username === 'admin' && (password === 'admin' || password === 'admin123')) {
        const adminData = {
          uid: 'admin-fixed-id',
          username: 'admin',
          status: 'approved',
          role: 'admin',
          displayName: 'Admin Manager',
        };

        try {
          await apiRequest('/api/auth/register', {
            method: 'POST',
            body: { ...adminData, password: password, id: 'admin-fixed-id' },
          });
        } catch (e) {}

        if (remember) {
          safeLocalStorage.setItem('isAdminMode', 'true');
        } else {
          safeSessionStorage.setItem('isAdminMode', 'true');
        }
      }

      // MySQL login with session collision check
      const endpoint = force ? '/api/auth/force-logout' : '/api/auth/login';
      const data = await apiRequest(endpoint, {
        method: 'POST',
        body: { username, password, force, browserSessionId: BROWSER_SESSION_ID },
      });

      if (data.status !== 'success') {
        handleAuthApiResponse(401, data);
        setIsAuthLoading(false);
        return;
      }

      if (data.token) {
        setAuthToken(data.token);
      }

      const userData = data.user as UserProfile;
      if (userData.permissions && typeof userData.permissions === 'string') {
        try {
          userData.permissions = JSON.parse(userData.permissions);
        } catch (e) {
          console.error('Failed to parse user permissions on login:', e);
        }
      }

      const rawAvatar = userData.avatar_url || userData.photoURL || userData.avatarUrl || null;
      userData.avatar_url = rawAvatar || undefined;
      userData.photoURL = rawAvatar || undefined;
      userData.avatarUrl = rawAvatar || undefined;

      // Prefetch critical dashboard data
      try {
        const canSeeAllProjects = userData.role === 'admin' || userData.role === 'head';
        const url = canSeeAllProjects ? '/api/projects' : `/api/projects?userId=${userData.uid}`;
        const [projectsRes, masterRes] = await Promise.all([
          apiRequest(url).catch(() => null),
          apiRequest('/api/master-data').catch(() => null),
        ]);

        if (projectsRes?.status === 'success') {
          const projs = projectsRes.data as any[];
          setProjects?.(projs);
          setSelectedProject?.(projs.length > 0 ? projs[0] : null);
        }

        if (masterRes?.status === 'success') {
          const result = masterRes.data as any[];
          const uniqueData = Array.from(
            new Map(result.map((m) => [`${m.type}-${m.label}`, m])).values()
          );
          setMasterData?.(uniqueData);
          if (uniqueData.length > 0) {
            const statuses = uniqueData.filter((d) => d.type === 'status');
            const priorities = uniqueData.filter((d) => d.type === 'priority');
            if (statuses.length > 0) setNewTaskStatus?.(statuses[0].label);
            if (priorities.length > 0) setNewTaskPriority?.(priorities[0].label);
          }
        }
      } catch (e) {
        console.warn('Failed to prefetch data:', e);
      }

      // Security delay for browser password managers
      if (!force) {
        setLoginStatusText('Memverifikasi keamanan sesi...');
        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      setIsAuthLoading(false);
      setIsLoggedIn(true);
      setUserRole(userData.role);
      setCurrentUser(userData);
      setCurrentUserProfile(userData);
      setShowCollisionModal(false);
      setActiveSessionData(null);
      setPendingLoginCredentials(null);

      if (remember) {
        safeLocalStorage.setItem('sessionUser', JSON.stringify(userData));
        safeLocalStorage.setItem('rememberUser', 'true');
      } else {
        safeSessionStorage.setItem('sessionUser', JSON.stringify(userData));
        safeLocalStorage.removeItem('rememberUser');
      }

      toast.success(`Selamat datang kembali, ${userData?.displayName || username}`);
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 409) {
        console.warn('Session collision detected');
        setActiveSessionData(e.data.activeSession);
        setPendingLoginCredentials({ username, password, remember });
        setShowCollisionModal(true);
        setIsAuthLoading(false);
        return;
      }

      setIsAuthLoading(false);
      const errStatus = e.status || 500;
      const isExpectedAuthError =
        errStatus === 429 ||
        errStatus === 403 ||
        (e.message &&
          (e.message.includes('belum aktif') ||
            e.message.includes('belum di aktifkan') ||
            e.message.includes('pending') ||
            e.message.toLowerCase().includes('terblokir') ||
            e.message.toLowerCase().includes('salah') ||
            e.message.toLowerCase().includes('credentials') ||
            e.message.toLowerCase().includes('tidak ditemukan') ||
            e.message.toLowerCase().includes('gagal terhubung') ||
            e.message.toLowerCase().includes('failed to fetch')));

      if (isExpectedAuthError) {
        console.warn('Login issue:', e.message);
      } else {
        console.error('Login error:', e);
      }

      if (
        errStatus === 403 ||
        (e.message &&
          (e.message.includes('menunggu persetujuan') ||
            e.message.includes('ditolak') ||
            e.message.includes('belum aktif') ||
            e.message.includes('belum di aktifkan') ||
            e.message.includes('pending')))
      ) {
        let cleanMsg = e.message || `Akun ${username} belum dapat diakses. Silakan hubungi admin.`;
        if (
          cleanMsg.includes('Rute API') ||
          cleanMsg.includes('Status: 403') ||
          cleanMsg.includes('Response bukan') ||
          cleanMsg.includes('Server error')
        ) {
          cleanMsg = `Akun ${username} belum dapat diakses. Silakan hubungi admin.`;
        }

        const isRejected = cleanMsg.toLowerCase().includes('ditolak');
        Swal.fire({
          icon: isRejected ? 'error' : 'warning',
          title: isRejected ? 'Pendaftaran Ditolak' : 'Akses Ditolak',
          text: cleanMsg,
          confirmButtonColor: '#405189',
        });
      } else if (errStatus === 429 || (e.message && e.message.toLowerCase().includes('terblokir'))) {
        handleAuthApiResponse(429, { message: e.message });
      } else if (e.message && (e.message.toLowerCase().includes('salah') || e.message.toLowerCase().includes('credentials') || e.message.toLowerCase().includes('tidak ditemukan'))) {
        handleAuthApiResponse(401, { message: e.message });
      } else if (e.message && (e.message.toLowerCase().includes('gagal terhubung') || e.message.toLowerCase().includes('failed to fetch'))) {
        toast.error('Gagal terhubung ke server. Silakan periksa koneksi Anda dan coba lagi.');
      } else {
        handleAuthApiResponse(errStatus, { message: e.message || 'Terjadi kesalahan saat login.' });
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Register handler
  const handleRegister = async (
    username: string,
    password: string,
    name: string,
    email: string,
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      setIsAuthLoading(true);

      const data = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: { username, password, nama_lengkap: name, email },
      });

      if (data.status !== 'success') {
        toast.error(data.message || 'Pendaftaran gagal.');
        return { success: false, message: data.message };
      }

      return { success: true, message: data.message };
    } catch (e: any) {
      console.error('Registration error:', e);
      toast.error(e?.message || 'Terjadi kesalahan pendaftaran.');
      return { success: false, message: e?.message };
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Effect: Listen for auth expiration
  useEffect(() => {
    const handleAuthExpired = () => {
      handleLogout();
    };
    window.addEventListener('auth_expired', handleAuthExpired);
    return () => window.removeEventListener('auth_expired', handleAuthExpired);
  }, []);

  // Effect: Fetch all users when logged in
  useEffect(() => {
    if (isLoggedIn) {
      const timer = setTimeout(() => {
        fetchAllUsers();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isLoggedIn]);

  // Effect: Listen for user profile updates
  useEffect(() => {
    const handleProfileUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      const updatedUser = customEvent.detail;
      if (updatedUser) {
        const currentUid = currentUser?.uid || user?.uid || currentUserProfile?.id || currentUserProfile?.uid;
        const targetUid = updatedUser.uid || updatedUser.id;

        if (currentUid && targetUid && String(currentUid) === String(targetUid)) {
          setCurrentUserProfile((prev) => ({
            ...prev,
            ...updatedUser,
            permissions: updatedUser.permissions,
          }));
          if (updatedUser.role) {
            setUserRole(updatedUser.role);
          }
        }
        fetchAllUsers();
      }
    };
    window.addEventListener('user_profile_updated', handleProfileUpdated);
    return () => window.removeEventListener('user_profile_updated', handleProfileUpdated);
  }, [currentUser?.uid, user?.uid, currentUserProfile?.id, currentUserProfile?.uid]);

  return {
    isLoggedIn,
    currentUser,
    userRole,
    currentUserProfile,
    authView,
    setAuthView,
    socket,
    setSocket,
    showCollisionModal,
    activeSessionData,
    pendingLoginCredentials,
    isAuthLoading,
    loginStatusText,
    setLoginStatusText,
    effectiveRole,
    handleLogout,
    handleLogoutRequest,
    handleManualLogin,
    handleRegister,
    setIsLoggedIn,
    setCurrentUser,
    setUserRole,
    setCurrentUserProfile,
    setShowCollisionModal,
    setPendingLoginCredentials,
    fetchAllUsers,
  };
}
