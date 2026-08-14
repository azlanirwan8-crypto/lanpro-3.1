import { UserProfile, Project, Task, MasterData, AppRole, UserPermissions } from '../../types';

/**
 * Isi form pada modal edit pengguna.
 *
 * Sebelumnya sembilan potong state terpisah di useAdminUsers, sehingga hook
 * mengembalikan 18 nilai yang harus dioper satu per satu ke modal. Digabung
 * menjadi satu objek agar antarmuka modal tetap kecil.
 */
export interface EditUserForm {
  role: AppRole;
  status: UserProfile['status'];
  permissions: UserPermissions;
  department: string;
  position: string;
  fullName: string;
  email: string;
  /** Kosong berarti kata sandi tidak diubah. */
  password: string;
  phone: string;
}

export interface AdminUserPanelProps {
  onAddUser: () => void;
  projects: Project[];
  tasks: Task[];
  masterData: MasterData[];
  userRole: AppRole | null;
  currentUserId?: string;
  onRefreshProjects?: () => void;
  onSelectUserForDetail?: (user: UserProfile) => void;
}

export const DEFAULT_PERMISSIONS: UserPermissions = {
  dashboard: { create: false, read: true, update: false, delete: false },
  meetingNotes: { create: true, read: true, update: true, delete: false },
  wiki: { create: true, read: true, update: true, delete: false },
  notebooklm: { create: true, read: true, update: true, delete: false },
  flowchart: { create: true, read: true, update: true, delete: false },
  list: { create: true, read: true, update: true, delete: false },
  sprints: { create: false, read: true, update: false, delete: false },
  board: { create: false, read: true, update: true, delete: false },
  qa: { create: true, read: true, update: true, delete: false },
  timeline: { create: false, read: true, update: false, delete: false },
  access: { create: false, read: true, update: false, delete: false },
  userManagement: { create: false, read: false, update: false, delete: false },
  masterData: { create: false, read: false, update: false, delete: false },
  auditLog: { create: false, read: false, update: false, delete: false },
  dbExplorer: { create: false, read: false, update: false, delete: false },
  settings: { create: false, read: false, update: false, delete: false },
};

/** Nilai awal form edit, dipakai saat hook diinisialisasi. */
export function createEmptyEditForm(): EditUserForm {
  return {
    role: 'user',
    status: 'pending',
    permissions: DEFAULT_PERMISSIONS,
    department: '',
    position: '',
    fullName: '',
    email: '',
    password: '',
    phone: '',
  };
}
