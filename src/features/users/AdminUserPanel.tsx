import React from 'react';
import {
  Users, UserPlus, Search, Edit2, Trash2, CheckCircle, XCircle, Clock, Save,
  ShieldAlert, Server, ChevronLeft, ChevronRight, Layout, ChevronDown, Copy,
  ShieldCheck, Award, UserCog, Eye, Info, HelpCircle, Lock, Shield, Download, Key
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { AppRole, UserPermissions } from '../../types';
import { AdminUserPanelProps, DEFAULT_PERMISSIONS } from './types';
import { DEFAULT_PERMISSIONS as ROLE_DEFAULT_PERMISSIONS } from '../../lib/permissions';
import { useAdminUsers } from './hooks';
import { Button, Modal, UserAvatar } from './styles';
import { toast } from 'sonner';
import {
  MODULE_DESCRIPTIONS,
  ROLE_DESCRIPTIONS,
  ACTION_DESCRIPTIONS,
} from './constants';
import {
  assignUserToProject,
  removeUserFromProject,
  registerUser,
  updateUser,
  deleteUser,
} from './services/users.service';

const Input = ({ value, onChange, placeholder, type = 'text', className = '', ...props }: any) => (
  <input
    type={type}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    className={`w-full px-4 py-3 bg-surface-sunken border border-border-subtle rounded-xl text-sm font-medium text-content-strong placeholder:text-content-subtle placeholder:font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-surface outline-none transition-all ${className}`}
    {...props}
  />
);

export const AdminUserPanel: React.FC<AdminUserPanelProps> = (props) => {
  const { projects, tasks, masterData } = props;
  const [isInviteModalOpen, setIsInviteModalOpen] = React.useState(false);
  const [isInviteSuccessModalOpen, setIsInviteSuccessModalOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'overview' | 'settings'>('overview');

  // Project Assignment State
  const [selectedAssignProjectId, setSelectedAssignProjectId] = React.useState('');
  const [selectedAssignProjectRole, setSelectedAssignProjectRole] = React.useState('member');
  const [isAssigningProject, setIsAssigningProject] = React.useState(false);
  const [selectedTeamMemberIds, setSelectedTeamMemberIds] = React.useState<string[]>([]);

  // Custom confirmation modal state to avoid iframe window.confirm block
  const [confirmModal, setConfirmModal] = React.useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Tooltip Mouse Event Handler State
  const [hoveredTooltip, setHoveredTooltip] = React.useState<{ text: string; x: number; y: number } | null>(null);

  const handleMouseEnter = (text: string, e: React.MouseEvent) => {
    const tooltipWidth = 260; // max-w-xs approximate
    const tooltipHeight = 70;

    let x = e.clientX;
    let y = e.clientY;

    // Safety boundaries to avoid viewport overflow
    if (x + tooltipWidth > window.innerWidth) {
      x = window.innerWidth - tooltipWidth - 20;
    }
    if (y + tooltipHeight > window.innerHeight) {
      y = window.innerHeight - tooltipHeight - 20;
    }

    setHoveredTooltip({
      text,
      x,
      y
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (hoveredTooltip) {
      const tooltipWidth = 260;
      const tooltipHeight = 70;
      let x = e.clientX;
      let y = e.clientY;

      if (x + tooltipWidth > window.innerWidth) {
        x = window.innerWidth - tooltipWidth - 20;
      }
      if (y + tooltipHeight > window.innerHeight) {
        y = window.innerHeight - tooltipHeight - 20;
      }

      setHoveredTooltip({
        text: hoveredTooltip.text,
        x,
        y
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredTooltip(null);
  };

  const handleAssignProject = async (userId: string) => {
    if (!selectedAssignProjectId) {
      toast.error('Pilih project terlebih dahulu');
      return;
    }
    setIsAssigningProject(true);
    try {
      const payload: any = {
        newMemberId: userId,
        newMemberRole: selectedAssignProjectRole
      };
      if (selectedAssignProjectRole === 'admin') {
        payload.teamMemberIds = selectedTeamMemberIds;
      }

      const data = await assignUserToProject(selectedAssignProjectId, props.currentUserId, payload);
      if (data.status === 'success') {
        toast.success('User berhasil ditambahkan ke Project!');
        setSelectedAssignProjectId('');
        setSelectedAssignProjectRole('member');
        setSelectedTeamMemberIds([]);
        if (props.onRefreshProjects) {
          props.onRefreshProjects();
        } else {
          setTimeout(() => {
            window.location.reload();
          }, 800);
        }
      } else {
        toast.error(data.message || 'Gagal menambahkan ke project');
      }
    } catch (e) {
      console.error(e);
      toast.error('Terjadi kesalahan saat menambahkan ke project');
    } finally {
      setIsAssigningProject(false);
    }
  };

  const handleRemoveProject = (projectId: string, userId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Keluarkan dari Project',
      message: 'Apakah Anda yakin ingin mengeluarkan user dari project ini?',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));

        try {
          const data = await removeUserFromProject(projectId, props.currentUserId, userId);
          if (data.status === 'success') {
            toast.success('User berhasil dihapus dari Project');
            if (props.onRefreshProjects) {
              props.onRefreshProjects();
            } else {
              setTimeout(() => {
                window.location.reload();
              }, 800);
            }
          } else {
            toast.error(data.message || 'Gagal menghapus user dari project');
          }
        } catch (e) {
          console.error(e);
          toast.error('Terjadi kesalahan saat menghapus user dari project');
        }
      }
    });
  };

  const [addPeopleUsername, setAddPeopleUsername] = React.useState('');
  const [addPeopleFullName, setAddPeopleFullName] = React.useState('');
  const [addPeopleEmail, setAddPeopleEmail] = React.useState('');
  const [addPeoplePassword, setAddPeoplePassword] = React.useState('');
  const [addPeoplePhone, setAddPeoplePhone] = React.useState('');
  const [addPeopleDepartment, setAddPeopleDepartment] = React.useState('');
  const [addPeopleJabatan, setAddPeopleJabatan] = React.useState('');
  const [addPeopleRole, setAddPeopleRole] = React.useState<AppRole>('user');
  const [addPeopleStatus, setAddPeopleStatus] = React.useState<'approved' | 'pending' | 'rejected'>('approved');
  const [successEmail, setSuccessEmail] = React.useState('');

  const handleAddPeople = async () => {
    if (!addPeopleUsername || !addPeopleFullName || !addPeopleEmail || !addPeoplePassword) {
      toast.error('Semua kolom wajib diisi');
      return;
    }

    try {
      const normalizedUsername = addPeopleUsername.trim().toLowerCase().replace(/\s+/g, '_');
      const selectedRolePermissions = ROLE_DEFAULT_PERMISSIONS[addPeopleRole] || ROLE_DEFAULT_PERMISSIONS.viewer;

      const data = await registerUser({
        username: normalizedUsername,
        password: addPeoplePassword,
        displayName: addPeopleFullName,
        email: addPeopleEmail,
        department: addPeopleDepartment,
        position: addPeopleJabatan,
        status: addPeopleStatus,
        role: addPeopleRole,
        permissions: selectedRolePermissions,
        phone: addPeoplePhone
      });

      if (data.status !== 'success') {
         toast.error(data.message || 'Username sudah digunakan atau register gagal');
         return;
      }

      setSuccessEmail(addPeopleEmail);
      setIsInviteModalOpen(false);
      setIsInviteSuccessModalOpen(true);

      setAddPeopleUsername('');
      setAddPeopleFullName('');
      setAddPeopleEmail('');
      setAddPeoplePassword('');
      setAddPeoplePhone('');
      setAddPeopleDepartment('');
      setAddPeopleJabatan('');
      setAddPeopleRole('user');
      setAddPeopleStatus('approved');

    } catch (e) {
      console.error('Error adding user:', e);
      toast.error('Failed to add user');
    }
  };

  const {
    users,
    searchTerm,
    setSearchTerm,
    loading,
    selectedUser,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    sortField,
    setSortField,
    sortOrder,
    setSortOrder,
    filterRole,
    setFilterRole,
    filterStatus,
    setFilterStatus,
    handleDeleteUser,
    filteredUsers,
    totalPages,
    paginatedUsers,
    fetchUsers
  } = useAdminUsers();

  const handleSort = (field: 'name' | 'department' | 'role' | 'status') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Point 1: Bulk Actions State
  const [selectedUserIds, setSelectedUserIds] = React.useState<string[]>([]);
  const [isBulkActionPending, setIsBulkActionPending] = React.useState(false);

  // Point 5: Real-time validation errors & Password Strength Indicator
  const [usernameError, setUsernameError] = React.useState('');
  const [emailError, setEmailError] = React.useState('');
  const [passwordStrength, setPasswordStrength] = React.useState<'weak' | 'medium' | 'strong' | ''>('');

  // Clean-up selections on filters change
  React.useEffect(() => {
    setSelectedUserIds([]);
  }, [searchTerm, filterRole, filterStatus]);

  // Username validation helper
  const handleUsernameChange = (val: string) => {
    setAddPeopleUsername(val);
    if (!val) {
      setUsernameError('Username wajib diisi');
      return;
    }
    const clean = val.trim().toLowerCase();
    if (clean !== val) {
      setUsernameError('Username harus huruf kecil semua, tanpa spasi');
      return;
    }
    const regex = /^[a-z0-9_]{3,20}$/;
    if (!regex.test(val)) {
      setUsernameError('Hanya huruf kecil, angka, dan underscore (3-20 karakter)');
    } else {
      setUsernameError('');
    }
  };

  // Email validation helper
  const handleEmailChange = (val: string) => {
    setAddPeopleEmail(val);
    if (!val) {
      setEmailError('Email wajib diisi');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val)) {
      setEmailError('Format email tidak valid (contoh: nama@domain.com)');
    } else {
      setEmailError('');
    }
  };

  // Password Strength check helper
  const handlePasswordChange = (val: string) => {
    setAddPeoplePassword(val);
    if (!val) {
      setPasswordStrength('');
      return;
    }
    if (val.length < 6) {
      setPasswordStrength('weak');
    } else if (val.length < 10) {
      const hasNumbers = /\d/.test(val);
      const hasSps = /[^a-zA-Z0-9]/.test(val);
      if (hasNumbers || hasSps) {
        setPasswordStrength('medium');
      } else {
        setPasswordStrength('weak');
      }
    } else {
      const hasNumbers = /\d/.test(val);
      const hasSps = /[^a-zA-Z0-9]/.test(val);
      if (hasNumbers && hasSps) {
        setPasswordStrength('strong');
      } else {
        setPasswordStrength('medium');
      }
    }
  };

  // Point 2: Export currently filtered users to CSV file
  const handleExportCSV = () => {
    try {
      if (filteredUsers.length === 0) {
        toast.error('Tidak ada data user untuk di-export');
        return;
      }

      const headers = ['ID', 'Username', 'Nama Lengkap', 'Email', 'No HP/WA', 'Role', 'Status', 'Departemen', 'Jabatan', 'Dibuat Pada'];
      const rows = filteredUsers.map(u => [
        u.id,
        u?.username || '',
        u?.displayName || '',
        u?.email || '',
        u.phone || '',
        u.role || '',
        u.status || '',
        u.department ? getDepartmentName(u.department) : '',
        u.position ? getPositionName(u.position) : '',
        (u as any).createdAt || ''
      ]);

      const csvContent = "data:text/csv;charset=utf-8,"
        + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `user_list_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Berhasil meng-export ${filteredUsers.length} user ke CSV!`);
    } catch (e) {
      console.error(e);
      toast.error('Gagal meng-export CSV');
    }
  };

  // Point 1: Bulk Action executor calling existing backend PUT/DELETE
  const handleBulkAction = async (action: 'approve' | 'reject' | 'delete' | AppRole) => {
    if (selectedUserIds.length === 0) {
      toast.error('Pilih setidaknya satu user');
      return;
    }

    if (action === 'delete') {
      const hasAdmins = filteredUsers.some(u => selectedUserIds.includes(u.id) && u.role === 'admin');
      if (hasAdmins) {
        toast.error('Tidak dapat menghapus user dengan role Admin secara massal');
        return;
      }
      const hasSelf = selectedUserIds.includes(props.currentUserId || '');
      if (hasSelf) {
        toast.error('Tidak dapat menghapus akun Anda sendiri secara massal');
        return;
      }
    }

    setIsBulkActionPending(true);
    let successCount = 0;
    let failCount = 0;

    try {
      await Promise.all(selectedUserIds.map(async (userId) => {
        try {
          if (action === 'delete') {
            const data = await deleteUser(userId);
            if (data.status === 'success') successCount++;
            else failCount++;
          } else if (action === 'approve' || action === 'reject') {
            const data = await updateUser(userId, { status: action === 'approve' ? 'approved' : 'rejected' });
            if (data.status === 'success') successCount++;
            else failCount++;
          } else {
            const data = await updateUser(userId, { role: action });
            if (data.status === 'success') successCount++;
            else failCount++;
          }
        } catch (err) {
          failCount++;
          console.error(`Error bulk action on user ${userId}:`, err);
        }
      }));

      toast.success(`Aksi Massal Selesai! Berhasil: ${successCount}, Gagal: ${failCount}`);
      setSelectedUserIds([]);
      fetchUsers();
    } catch (e) {
      console.error(e);
      toast.error('Gagal menjalankan aksi massal');
    } finally {
      setIsBulkActionPending(false);
    }
  };

  const getDepartmentName = (id: string) => masterData.find(d => d.type === 'department' && d.id === id)?.label || id;
  const getPositionName = (id: string) => masterData.find(d => d.type === 'jabatan' && d.id === id)?.label || id;

  const totalUsersCount = users.length;
  const approvedUsersCount = users.filter(u => u.status === 'approved').length;
  const pendingUsersCount = users.filter(u => u.status === 'pending').length;
  const adminUsersCount = users.filter(u => u.role === 'admin').length;

  if (loading) {
    return <div className="p-8 text-center text-content-muted animate-pulse">Loading users...</div>;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-sunken w-full h-full">
      <div className="flex-1 overflow-y-auto p-3 md:p-6 w-full animate-in fade-in duration-700">
        <div className="flex flex-col space-y-6 min-h-full">
          {/* Header & Controls */}
          <div className="bg-surface rounded-lg shadow-sm border border-border-subtle/80 p-4 shrink-0">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-50/80 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center border border-blue-100/60 dark:border-blue-900/40 shrink-0">
                        <Users className="w-4.5 h-4.5" />
                    </div>
                    <div>
                        <h3 className="text-base font-medium text-content-strong tracking-tight leading-none">User Management</h3>
                        <p className="text-content-subtle font-medium text-[11px] mt-1">Manage user access, roles, and permissions.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExportCSV}
                        className="bg-surface-sunken hover:bg-surface-muted text-content-body border border-border-subtle hover:border-slate-300 font-medium py-1.5 px-3 rounded text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-[0.98] shadow-2xs h-8.5"
                    >
                        <Download className="w-3.5 h-3.5 text-content-muted" /> Export CSV
                    </button>
                    <Button
                        onClick={() => setIsInviteModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-1.5 px-3 rounded text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-[0.98] shadow-sm h-8.5"
                    >
                        <UserPlus className="w-3.5 h-3.5" /> Add User
                    </Button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-subtle" />
                    <input
                        type="text"
                        placeholder="Search by name, username, or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-surface-sunken/50 border border-border-subtle/80 rounded focus:bg-surface focus:ring-1 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none text-xs h-8.5 font-medium text-content-strong placeholder:text-content-subtle"
                    />
                </div>
                <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                    className="px-3 py-1.5 bg-surface-sunken/50 border border-border-subtle/80 rounded focus:bg-surface focus:ring-1 focus:ring-indigo-500/10 outline-none text-content-body font-medium text-xs cursor-pointer h-8.5"
                >
                    <option value="all">All Roles</option>
                    <option value="admin">Admin</option>
                    <option value="head">Head</option>
                    <option value="manager">Manager</option>
                    <option value="user">User</option>
                    <option value="viewer">Viewer</option>
                </select>
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-1.5 bg-surface-sunken/50 border border-border-subtle/80 rounded focus:bg-surface focus:ring-1 focus:ring-indigo-500/10 outline-none text-content-body font-medium text-xs cursor-pointer h-8.5"
                >
                    <option value="all">All Status</option>
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                    <option value="rejected">Rejected</option>
                </select>
            </div>
          </div>

          {/* Statistics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
              <div className="bg-surface p-3.5 rounded-lg border border-border-subtle/60 shadow-2xs flex items-center gap-3 transition-all hover:shadow-xs">
                  <div className="w-9 h-9 bg-blue-50/80 text-blue-600 rounded-lg flex items-center justify-center border border-blue-100/40 shrink-0">
                      <Users className="w-4.5 h-4.5" />
                  </div>
                  <div>
                      <div className="text-[10px] font-medium text-content-subtle uppercase tracking-wider">Total User</div>
                      <div className="text-lg font-medium text-content-strong leading-none mt-1">{totalUsersCount}</div>
                  </div>
              </div>
              <div className="bg-surface p-3.5 rounded-lg border border-border-subtle/60 shadow-2xs flex items-center gap-3 transition-all hover:shadow-xs">
                  <div className="w-9 h-9 bg-emerald-50/80 text-emerald-600 rounded-lg flex items-center justify-center border border-emerald-100/40 shrink-0">
                      <CheckCircle className="w-4.5 h-4.5" />
                  </div>
                  <div>
                      <div className="text-[10px] font-medium text-content-subtle uppercase tracking-wider">Disetujui</div>
                      <div className="text-lg font-medium text-content-strong leading-none mt-1">{approvedUsersCount}</div>
                  </div>
              </div>
              <div className="bg-surface p-3.5 rounded-lg border border-border-subtle/60 shadow-2xs flex items-center gap-3 transition-all hover:shadow-xs">
                  <div className="w-9 h-9 bg-amber-50/80 text-amber-500 rounded-lg flex items-center justify-center border border-amber-100/40 shrink-0">
                      <Clock className="w-4.5 h-4.5" />
                  </div>
                  <div>
                      <div className="text-[10px] font-medium text-content-subtle uppercase tracking-wider">Menunggu</div>
                      <div className="text-lg font-medium text-content-strong leading-none mt-1">{pendingUsersCount}</div>
                  </div>
              </div>
              <div className="bg-surface p-3.5 rounded-lg border border-border-subtle/60 shadow-2xs flex items-center gap-3 transition-all hover:shadow-xs">
                  <div className="w-9 h-9 bg-rose-50/80 text-rose-600 rounded-lg flex items-center justify-center border border-rose-100/40 shrink-0">
                      <Shield className="w-4.5 h-4.5" />
                  </div>
                  <div>
                      <div className="text-[10px] font-medium text-content-subtle uppercase tracking-wider">Administrator</div>
                      <div className="text-lg font-medium text-content-strong leading-none mt-1">{adminUsersCount}</div>
                  </div>
              </div>
          </div>

          {/* User List */}
          <div className="bg-surface rounded-xl shadow-sm border border-border-subtle/50 overflow-hidden flex-1 flex flex-col">
            {selectedUserIds.length > 0 && (
            <div className="bg-indigo-50/80 border-b border-indigo-100 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-top duration-300">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-medium flex items-center justify-center">
                  {selectedUserIds.length}
                </span>
                <span className="text-sm font-medium text-indigo-950">pengguna terpilih untuk Aksi Massal</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleBulkAction('approve')}
                  disabled={isBulkActionPending}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Setujui
                </button>
                <button
                  onClick={() => handleBulkAction('reject')}
                  disabled={isBulkActionPending}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" /> Pending/Tolak
                </button>

                <div className="relative inline-block text-left">
                  <select
                    disabled={isBulkActionPending}
                    onChange={(e) => {
                      if (e.target.value) {
                        handleBulkAction(e.target.value as AppRole);
                        e.target.value = "";
                      }
                    }}
                    className="px-3.5 py-1.5 bg-surface border border-border-subtle text-slate-750 text-xs font-medium rounded-lg shadow-2xs focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
                  >
                    <option value="">Ubah Role Massal...</option>
                    <option value="admin">Administrator</option>
                    <option value="head">Department Head</option>
                    <option value="manager">Project Manager</option>
                    <option value="user">Standard User</option>
                    <option value="viewer">Observer</option>
                  </select>
                </div>

                <button
                  onClick={() => {
                    setConfirmModal({
                      isOpen: true,
                      title: 'Hapus Pengguna Massal',
                      message: `Apakah Anda yakin ingin menghapus ${selectedUserIds.length} pengguna terpilih secara massal? Tindakan ini tidak dapat dibatalkan.`,
                      onConfirm: () => handleBulkAction('delete')
                    });
                  }}
                  disabled={isBulkActionPending}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Hapus Massal
                </button>
                <button
                  onClick={() => setSelectedUserIds([])}
                  disabled={isBulkActionPending}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-705 text-xs font-medium rounded-lg transition-all cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-surface-sunken/80 border-b border-border-faint text-[11px] font-medium text-content-muted uppercase tracking-wider whitespace-nowrap">
                  <th className="py-3.5 px-4 text-center w-12">
                    <input
                      type="checkbox"
                      checked={paginatedUsers.length > 0 && paginatedUsers.every(u => selectedUserIds.includes(u.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const newIds = [...selectedUserIds];
                          paginatedUsers.forEach(u => {
                            if (!newIds.includes(u.id)) newIds.push(u.id);
                          });
                          setSelectedUserIds(newIds);
                        } else {
                          const paginatedIds = paginatedUsers.map(u => u.id);
                          setSelectedUserIds(selectedUserIds.filter(id => !paginatedIds.includes(id)));
                        }
                      }}
                      className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th
                    onClick={() => handleSort('name')}
                    className="py-3.5 px-4 w-60 cursor-pointer hover:bg-surface-muted/80 transition-colors select-none group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>User</span>
                      <span className="text-[10px] text-content-subtle group-hover:text-indigo-600">
                        {sortField === 'name' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('department')}
                    className="py-3.5 px-4 w-60 cursor-pointer hover:bg-surface-muted/80 transition-colors select-none group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Department / Position</span>
                      <span className="text-[10px] text-content-subtle group-hover:text-indigo-600">
                        {sortField === 'department' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className="py-3.5 px-4 w-40">Proyek & Tugas</th>
                  <th
                    onClick={() => handleSort('role')}
                    className="py-3.5 px-4 w-28 cursor-pointer hover:bg-surface-muted/80 transition-colors select-none group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Role</span>
                      <span className="text-[10px] text-content-subtle group-hover:text-indigo-600">
                        {sortField === 'role' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('status')}
                    className="py-3.5 px-4 w-28 text-center cursor-pointer hover:bg-surface-muted/80 transition-colors select-none group"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Status</span>
                      <span className="text-[10px] text-content-subtle group-hover:text-indigo-600">
                        {sortField === 'status' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className="py-3.5 px-4 w-28 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-faint/60">
                {paginatedUsers.map((user) => {
                  const userProjectsCount = (projects || []).filter(p =>
                    (p.members && (p.members.includes(user.id) || p.members.includes(user.uid))) ||
                    p.ownerId === user.id ||
                    p.ownerId === user.uid
                  ).length;

                  const userTasksCount = (tasks || []).filter(t =>
                    t.assigneeId === user.id ||
                    t.assigneeId === user.uid ||
                    (t.assignees && (t.assignees.includes(user.id) || t.assignees.includes(user.uid))) ||
                    t.assigneeEmail === user?.email
                  ).length;

                  return (
                    <tr key={user.id} className="hover:bg-indigo-50/30 transition-colors group">
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(user.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUserIds([...selectedUserIds, user.id]);
                            } else {
                              setSelectedUserIds(selectedUserIds.filter(id => id !== user.id));
                            }
                          }}
                          className="w-4 h-4 rounded text-indigo-650 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-4 cursor-pointer" onClick={() => { if (props.onSelectUserForDetail) props.onSelectUserForDetail(user); }}>
                        <div className="flex items-center gap-3.5">
                          <UserAvatar user={user} className="w-9 h-9 text-sm shrink-0" />
                          <div>
                            <div className="font-medium text-content-strong text-xs group-hover:text-indigo-600 transition-colors">
                              {user?.displayName || user?.username}
                            </div>
                            <div className="text-[11px] text-content-muted">{user?.email || 'Email tidak tersedia'}</div>
                            {user.phone && (
                              <div className="text-[10px] font-medium text-emerald-600 flex items-center gap-1 mt-0.5">
                                <span>WA/HP:</span>
                                <span>{user.phone}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                              <span className="text-xs font-medium text-content-body">
                                  {user.department ? getDepartmentName(user.department) : '-'}
                              </span>
                              <span className="text-[10px] text-content-muted uppercase tracking-widest">
                                  {user.position ? getPositionName(user.position) : '-'}
                              </span>
                          </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors",
                              userProjectsCount > 0
                                ? "bg-indigo-50/65 text-indigo-700 border-indigo-100/70"
                                : "bg-surface-sunken/50 text-content-subtle border-border-faint"
                            )}>
                              <Layout className="w-3 h-3 text-indigo-500" />
                              <span>{userProjectsCount} Proyek</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors",
                              userTasksCount > 0
                                ? "bg-violet-50/65 text-violet-700 border-violet-100/70"
                                : "bg-surface-sunken/50 text-content-subtle border-border-faint"
                            )}>
                              <CheckCircle className="w-3 h-3 text-violet-500" />
                              <span>{userTasksCount} Tugas</span>
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={cn(
                          "inline-flex font-medium text-[9px] tracking-widest uppercase px-2 py-0.5 rounded-md border",
                          user.role === 'admin' ? "bg-rose-50 text-rose-600 border-rose-200" :
                          user.role === 'head' ? "bg-purple-50 text-purple-600 border-purple-200" :
                          user.role === 'manager' ? "bg-blue-50 text-blue-600 border-blue-200" :
                          "bg-surface-sunken text-content-secondary border-border-subtle"
                        )}>
                          {user.role}
                        </span>
                      </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex justify-center">
                        {user.status === 'approved' ? (
                          <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500" title="Disetujui">
                            <CheckCircle className="w-3.5 h-3.5" />
                          </div>
                        ) : user.status === 'pending' ? (
                          <div className="w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 animate-pulse" title="Menunggu">
                            <Clock className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-rose-50 flex items-center justify-center text-rose-500" title="Ditolak">
                            <XCircle className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          // Cabang else sebelumnya membuka modal edit bawaan panel ini.
                          // Modal tersebut tidak pernah terbuka karena satu-satunya
                          // pemakai AdminUserPanel selalu mengirim onSelectUserForDetail,
                          // dan fungsinya sudah digantikan UserDetailView yang lebih
                          // lengkap. Modal beserta cabangnya ikut dihapus.
                          onClick={() => props.onSelectUserForDetail?.(user)}
                          className="p-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white border border-indigo-200/80 rounded-lg transition-all shadow-xs active:scale-95 cursor-pointer font-medium flex items-center justify-center gap-1"
                          title="Detail Pengguna"
                        >
                          <UserCog className="w-3.5 h-3.5 shrink-0" />
                        </button>
                        <button
                          onClick={() => {
                            setConfirmModal({
                              isOpen: true,
                              title: 'Hapus Pengguna',
                              message: `Apakah Anda yakin ingin menghapus pengguna ${user?.displayName || user?.username} secara permanen?`,
                              onConfirm: async () => {
                                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                try {
                                  const data = await deleteUser(user.id);
                                  if (data.status !== 'success') throw new Error(data.message);
                                  toast.success('User deleted successfully');
                                  fetchUsers(); // Refresh
                                } catch (error: any) {
                                  toast.error('Failed to delete user: ' + (error.message || 'Error'));
                                  console.error(error);
                                }
                              }
                            });
                          }}
                          disabled={user.role === 'admin'}
                          className="p-1.5 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200/80 rounded-lg transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-1"
                          title="Hapus Pengguna"
                        >
                          <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )})}
                {paginatedUsers.length === 0 && (
                   <tr>
                       <td colSpan={7} className="py-12 text-center text-content-muted">
                           No users found matching your criteria.
                       </td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>

           {/* Enterprise DataTable Pagination & Entries Controls */}
           <div className="border-t border-border-faint p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-sunken/50 mt-auto">
             <div className="flex items-center gap-3">
               <span className="text-xs font-medium text-content-muted">
                 Showing {filteredUsers.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredUsers.length)} of {filteredUsers.length} entries
               </span>
               <div className="flex items-center gap-1.5 text-xs text-content-muted font-medium">
                 <span>Rows per page:</span>
                 <select
                   value={itemsPerPage}
                   onChange={(e) => {
                     setItemsPerPage(Number(e.target.value));
                     setCurrentPage(1);
                   }}
                   className="bg-surface border border-border-subtle rounded-md px-2 py-1 text-xs font-medium text-content-body outline-none focus:border-indigo-500 cursor-pointer"
                 >
                   <option value={10}>10</option>
                   <option value={25}>25</option>
                   <option value={50}>50</option>
                   <option value={100}>100</option>
                 </select>
               </div>
             </div>

             <div className="flex items-center gap-1">
               <Button
                 variant="outline"
                 size="sm"
                 onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                 disabled={currentPage === 1}
                 className="rounded-lg h-8 px-2.5 text-xs font-medium"
               >
                 <ChevronLeft className="w-4 h-4 mr-1" /> Prev
               </Button>
               {Array.from({ length: totalPages }).map((_, i) => (
                   <button
                       key={i}
                       onClick={() => setCurrentPage(i + 1)}
                       className={cn(
                           "w-7 h-7 rounded-lg text-xs font-medium transition-colors",
                           currentPage === i + 1 ? "bg-indigo-600 text-white shadow-2xs" : "bg-surface border border-border-subtle text-content-secondary hover:bg-surface-sunken"
                       )}
                   >
                       {i + 1}
                   </button>
               ))}
               <Button
                 variant="outline"
                 size="sm"
                 onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                 disabled={currentPage === totalPages || totalPages === 0}
                 className="rounded-lg h-8 px-2.5 text-xs font-medium"
               >
                 Next <ChevronRight className="w-4 h-4 ml-1" />
               </Button>
             </div>
           </div>
        </div>
        </div>
      </div>


      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title="Add New User"
      >
        <div className="space-y-4">
          <div className="p-4 bg-violet-50 rounded-xl border border-violet-100 mb-2">
            <p className="text-sm font-medium text-violet-900">Registrasi Pengguna</p>
            <p className="text-xs text-violet-700 mt-1">Register new user to the system.</p>
          </div>

           <div className="space-y-3">
             <div>
               <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Username</label>
               <Input
                 value={addPeopleUsername}
                 onChange={(e: any) => handleUsernameChange(e.target.value)}
                 placeholder="e.g. john_doe"
                 className={usernameError ? "border-rose-500 focus:ring-rose-500/10 focus:border-rose-500" : ""}
               />
               {usernameError && (
                 <p className="text-[10px] font-medium text-rose-500 mt-1">{usernameError}</p>
               )}
             </div>
             <div>
               <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Nama Lengkap</label>
               <Input
                 value={addPeopleFullName}
                 onChange={(e: any) => setAddPeopleFullName(e.target.value)}
                 placeholder="e.g. John Doe"
               />
             </div>
             <div>
               <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Email</label>
               <Input
                 value={addPeopleEmail}
                 onChange={(e: any) => handleEmailChange(e.target.value)}
                 placeholder="john@example.com"
                 className={emailError ? "border-rose-500 focus:ring-rose-500/10 focus:border-rose-500" : ""}
               />
               {emailError && (
                 <p className="text-[10px] font-medium text-rose-500 mt-1">{emailError}</p>
               )}
             </div>
             <div>
               <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Nomor HP / WhatsApp</label>
               <Input
                 value={addPeoplePhone}
                 onChange={(e: any) => setAddPeoplePhone(e.target.value)}
                 placeholder="e.g. 081234567890"
               />
             </div>
             <div>
               <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Password</label>
               <Input
                 type="password"
                 value={addPeoplePassword}
                 onChange={(e: any) => handlePasswordChange(e.target.value)}
                 placeholder="••••••••"
               />
               {passwordStrength && (
                 <div className="mt-1.5 space-y-1">
                   <div className="flex gap-1 h-1.5 w-full bg-surface-muted rounded-full overflow-hidden">
                     <div className={cn(
                       "h-full rounded-full transition-all",
                       passwordStrength === 'weak' ? "bg-rose-500 w-1/3" :
                       passwordStrength === 'medium' ? "bg-amber-500 w-2/3" :
                       "bg-emerald-500 w-full"
                     )} />
                   </div>
                   <p className={cn(
                     "text-[10px] font-medium uppercase tracking-wider",
                     passwordStrength === 'weak' ? "text-rose-500" :
                     passwordStrength === 'medium' ? "text-amber-500" :
                     "text-emerald-500"
                   )}>
                     Kekuatan Password: {passwordStrength === 'weak' ? 'Lemah' : passwordStrength === 'medium' ? 'Sedang' : 'Kuat'}
                   </p>
                 </div>
               )}
             </div>
             <div>
               <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Departemen</label>
               <div className="relative group/select">
                 <select
                   value={addPeopleDepartment}
                   onChange={(e) => setAddPeopleDepartment(e.target.value)}
                   className="w-full px-4 py-2 bg-surface-sunken border border-border-subtle rounded-xl text-sm font-medium appearance-none cursor-pointer focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 focus:bg-surface outline-none transition-all"
                 >
                   <option value="">Pilih Departemen...</option>
                   {masterData.filter(d => d.type === 'department').map((dep) => (
                     <option key={dep.id} value={dep.id}>{dep.label}</option>
                   ))}
                 </select>
                 <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-content-subtle" />
               </div>
             </div>
             <div>
               <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Jabatan</label>
               <div className="relative group/select">
                 <select
                   value={addPeopleJabatan}
                   onChange={(e) => setAddPeopleJabatan(e.target.value)}
                   className="w-full px-4 py-2 bg-surface-sunken border border-border-subtle rounded-xl text-sm font-medium appearance-none cursor-pointer focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 focus:bg-surface outline-none transition-all"
                 >
                   <option value="">Pilih Jabatan...</option>
                   {masterData.filter(d => d.type === 'jabatan').map((j) => (
                     <option key={j.id} value={j.id}>{j.label}</option>
                   ))}
                 </select>
                 <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-content-subtle" />
               </div>
             </div>
             <div>
               <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">System Role</label>
               <div className="relative group/select">
                 <select
                   value={addPeopleRole}
                   onChange={(e) => setAddPeopleRole(e.target.value)}
                   className="w-full px-4 py-2 bg-surface-sunken border border-border-subtle rounded-xl text-sm font-medium appearance-none cursor-pointer focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 focus:bg-surface outline-none transition-all"
                 >
                   <option value="admin">Administrator (Full Access)</option>
                   <option value="head">Department Head (Head)</option>
                   <option value="manager">Project Manager (Manager)</option>
                   <option value="user">Standard User (User)</option>
                   <option value="viewer">Observer (Viewer - Read Only)</option>
                   {masterData
                     .filter(d => d.type === 'project_role' && (d.roleType === 'SYSTEM' || d.role_type === 'SYSTEM'))
                     .map(role => {
                       const roleValue = (role.label || '').toLowerCase();
                       if (['admin', 'head', 'manager', 'user', 'viewer', 'administrator', 'department head', 'project manager', 'standard user', 'observer'].includes(roleValue)) {
                         return null;
                       }
                       return (
                         <option key={role.id} value={role.label}>
                           {role.label}
                         </option>
                       );
                     })
                   }
                 </select>
                 <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-content-subtle" />
               </div>
             </div>
           </div>

           <div className="pt-4 flex gap-3">
             <Button variant="outline" onClick={() => setIsInviteModalOpen(false)} className="flex-1 justify-center">
               Cancel
             </Button>
             <Button
               onClick={handleAddPeople}
               disabled={!!usernameError || !!emailError || !addPeopleUsername || !addPeopleFullName || !addPeopleEmail || !addPeoplePassword}
               className="flex-1 justify-center bg-violet-600 hover:bg-violet-700 disabled:opacity-50"
             >
               <UserPlus className="w-4 h-4" /> Add Person
             </Button>
           </div>
        </div>
      </Modal>

      <Modal
        isOpen={isInviteSuccessModalOpen}
        onClose={() => {
            setIsInviteSuccessModalOpen(false);
            fetchUsers();
        }}
        title="Username Registration Successful"
      >
        <div className="space-y-6 text-center py-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserPlus className="w-8 h-8 text-green-600" />
          </div>
          <div>
             <h3 className="text-lg font-medium text-gray-900">Username Tercatat!</h3>
             <p className="text-sm text-gray-500 mt-2">
             Username <span className="font-medium text-gray-900">{addPeopleEmail}</span> has been saved in the system.
           </p>
         </div>

         <div className="space-y-3 pt-4">
           <Button
             variant="secondary"
             onClick={() => {
               navigator.clipboard.writeText(window.location.origin);
               toast.success('Link successfully copied!');
             }}
             className="w-full justify-center py-3"
           >
             <Copy className="w-4 h-4" /> Salin Link Bergabung
           </Button>
         </div>

           <button
             onClick={() => {
                 setIsInviteSuccessModalOpen(false);
                 fetchUsers();
             }}
             className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
           >
             Tutup
           </button>
         </div>
      </Modal>

      {confirmModal.isOpen && (
        <Modal
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
          title={confirmModal.title}
          maxWidth="max-w-md"
        >
          <div className="space-y-6 py-2">
            <p className="text-sm text-content-secondary leading-relaxed">
              {confirmModal.message}
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-sm"
              >
                Batal
              </Button>
              <Button
                variant="danger"
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 text-sm"
              >
                Ya, Hapus
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Senior Portal-Style Hover Tooltip overlay */}
      {hoveredTooltip && (
        <div
          className="fixed z-9999 pointer-events-none bg-slate-900/95 backdrop-blur-md border border-slate-700/80 text-white text-xs font-medium rounded-xl px-3.5 py-2.5 max-w-xs shadow-2xl transition-all duration-100 ease-out animate-in fade-in zoom-in-95"
          style={{
            left: `${hoveredTooltip.x + 14}px`,
            top: `${hoveredTooltip.y + 14}px`,
            transform: 'translate3d(0, 0, 0)',
          }}
        >
          <div className="flex items-start gap-2 max-w-[210px]">
            <Info className="w-4 h-4 text-indigo-300 shrink-0 mt-0.5" />
            <span className="leading-snug font-medium text-[11px] text-slate-255">{hoveredTooltip.text}</span>
          </div>
        </div>
      )}

    </div>
  );
};
