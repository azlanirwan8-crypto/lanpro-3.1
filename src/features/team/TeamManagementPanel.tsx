import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, LayoutGrid, List, Search, Download, ChevronDown, CheckCircle2,
  Clock, Shield, Mail, User, X, Star, FileText, Briefcase
} from 'lucide-react';
import { UserProfile, Project, Task, AppRole, MasterData } from '../../types';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { toast } from 'sonner';
// Diberi alias: komponen sudah punya fungsi lokal bernama fetchTeamTasks yang
// membungkus state loading dan penanganan unmount.
import { fetchTeamTasks as fetchTeamTasksApi } from './services/team.service';

export const TeamManagementPanel = ({ 
  projectMembers: propMembers,
  selectedProject,
  tasks: propTasks,
  currentUserProfile,
  userRole,
  hasPermission,
  StyledDropdown,
  updateProjectRole,
  removeProjectMember,
  masterData: propMaster,
  onRefreshProjects
}: {
  projectMembers: UserProfile[];
  selectedProject: Project | null;
  tasks: Task[];
  currentUserProfile: UserProfile | null;
  userRole: AppRole | null;
  hasPermission: (...args: any[]) => boolean;
  StyledDropdown?: any;
  updateProjectRole?: (uid: string, role: string) => void;
  removeProjectMember?: (uid: string) => Promise<void>;
  masterData?: MasterData[];
  onRefreshProjects?: () => void;
}) => {
  const [teamSearch, setTeamSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedProfileUser, setSelectedProfileUser] = useState<any | null>(null);
  const [teamTasks, setTeamTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  useEffect(() => {
    if (!selectedProject?.id) {
      setTeamTasks([]);
      return;
    }
    
    let isMounted = true;
    const fetchTeamTasks = async () => {
      setIsLoadingTasks(true);
      try {
        const res = await fetchTeamTasksApi(selectedProject.id);
        if (res.status === "success" && isMounted) {
          setTeamTasks(res.data || []);
        }
      } catch (err) {
        console.error("Error fetching team tasks:", err);
      } finally {
        if (isMounted) setIsLoadingTasks(false);
      }
    };
    
    fetchTeamTasks();
    return () => {
      isMounted = false;
    };
  }, [selectedProject?.id]);
  
  const rawMembers = Array.isArray(propMembers) ? propMembers : [];
  const tasks = teamTasks.length > 0 ? teamTasks : (Array.isArray(propTasks) ? propTasks : []);
  const masterData = Array.isArray(propMaster) ? propMaster : [];

  const getUserTasks = (person: any) => {
    if (!person) return [];
    const pIds = [person.uid, person.id, person.userId, person.email, person.username, person.displayName].filter(Boolean);
    return tasks.filter(t => {
      if (!t) return false;
      // Exclude Epic tasks from member task calculations and list views
      if (String(t.type || '').toLowerCase() === 'epic') return false;
      
      const aid = t.assigneeId;
      const aEmail = t.assigneeEmail;
      const assignees = t.assignees || [];
      return (
        (aid && pIds.some(id => String(id).toLowerCase() === String(aid).toLowerCase())) ||
        (aEmail && person.email && String(aEmail).toLowerCase() === String(person.email).toLowerCase()) ||
        (Array.isArray(assignees) && assignees.some(aId => pIds.some(id => String(id).toLowerCase() === String(aId).toLowerCase())))
      );
    });
  };

  // Filter strictly to users who have joined the selected project
  const joinedMembers = useMemo(() => {
    if (!selectedProject) return rawMembers;

    const projectOwnerId = selectedProject.ownerId;
    const projectMemberList = Array.isArray(selectedProject.members) ? selectedProject.members : [];
    const projectRolesMap = selectedProject.memberRoles || {};

    const hasExplicitMembers = projectMemberList.length > 0 || Object.keys(projectRolesMap).length > 0 || Boolean(projectOwnerId);

    if (!hasExplicitMembers) return rawMembers;

    const filtered = rawMembers.filter(m => {
      const uid = m.uid || (m as any).id;
      if (!uid) return false;
      const isOwner = projectOwnerId === uid;
      const isMember = projectMemberList.includes(uid);
      const hasRole = Object.prototype.hasOwnProperty.call(projectRolesMap, uid);
      return isOwner || isMember || hasRole;
    });

    return filtered.length > 0 ? filtered : rawMembers;
  }, [rawMembers, selectedProject]);

  const allPeople = useMemo(() => {
    const active = joinedMembers.map(m => ({ ...m, isPending: false }));
    const pending = (selectedProject?.pendingInvites || []).map((email: string) => ({
      uid: email,
      email,
      displayName: email.split('@')[0],
      isPending: true
    }));
    return [...active, ...pending];
  }, [joinedMembers, selectedProject]);

  // Filtered people based on search and role filter
  const filteredPeople = useMemo(() => {
    return allPeople.filter(p => {
      const search = teamSearch.toLowerCase();
      const pUser = p as any;
      const matchesSearch = (
        p?.displayName?.toLowerCase().includes(search) || 
        p?.email?.toLowerCase().includes(search) ||
        pUser?.username?.toLowerCase().includes(search) ||
        pUser?.role?.toLowerCase().includes(search)
      );
      
      const role = selectedProject?.memberRoles?.[p.uid] || pUser?.role || 'viewer';
      const matchesRole = roleFilter === 'all' || role.toLowerCase() === roleFilter.toLowerCase();
      return matchesSearch && matchesRole;
    });
  }, [allPeople, teamSearch, roleFilter, selectedProject]);

  const activeTeamCount = joinedMembers.length;
  const pendingInvitesCount = (selectedProject?.pendingInvites || []).length;
  const assignedTasksCount = tasks.filter(t => t.assigneeId && String(t.type || '').toLowerCase() !== 'epic').length;
  const projectTasksCount = tasks.filter(t => String(t.type || '').toLowerCase() !== 'epic').length;

  const handleExportTeamCSV = () => {
    try {
      if (filteredPeople.length === 0) {
        toast.error('Tidak ada data tim untuk di-export');
        return;
      }

      const headers = ['UID/Email', 'Nama Lengkap', 'Username', 'Project Role', 'Status', 'Jumlah Tugas'];
      const rows = filteredPeople.map(p => {
        const role = selectedProject?.memberRoles?.[p.uid] || (p as any)?.role || 'viewer';
        const isPending = p.isPending;
        const userAssignedTasks = getUserTasks(p);
        const taskCount = userAssignedTasks.length;
        return [
          p.uid,
          p?.displayName || '',
          (p as any)?.username || '',
          role,
          isPending ? 'Pending' : 'Active',
          taskCount
        ];
      });

      const csvContent = "data:text/csv;charset=utf-8," 
        + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `team_members_${selectedProject?.key || 'project'}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`Berhasil meng-export ${filteredPeople.length} anggota tim ke CSV!`);
    } catch (e) {
      console.error(e);
      toast.error('Gagal meng-export CSV');
    }
  };

  return (
    <div className="p-4 md:p-6 w-full h-[calc(100vh-80px)] flex flex-col overflow-hidden animate-in fade-in duration-300 text-left">
      {/* Fixed Top Section Wrapper */}
      <div className="shrink-0 space-y-5 pb-1">
        {/* Header Title */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-xl font-medium text-content-strong tracking-tight">Team Management</h1>
            <p className="text-xs text-content-muted font-medium mt-0.5">
              Daftar anggota tim yang bergabung dalam proyek {selectedProject ? <span className="font-medium text-content-body">{selectedProject.name} ({selectedProject.key})</span> : ''}
            </p>
          </div>
        </div>

        {/* Team Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface p-4 rounded-lg border border-border-subtle/80 shadow-2xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-medium text-content-subtle uppercase tracking-wider">Active Team</div>
                <div className="text-xl font-medium text-content-strong mt-0.5">{activeTeamCount}</div>
              </div>
            </div>
          </div>

          <div className="bg-surface p-4 rounded-lg border border-border-subtle/80 shadow-2xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-medium text-content-subtle uppercase tracking-wider">Assigned Tasks</div>
                <div className="text-xl font-medium text-content-strong mt-0.5">{assignedTasksCount}</div>
              </div>
            </div>
          </div>

          <div className="bg-surface p-4 rounded-lg border border-border-subtle/80 shadow-2xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-medium text-content-subtle uppercase tracking-wider">Pending Invites</div>
                <div className="text-xl font-medium text-content-strong mt-0.5">{pendingInvitesCount}</div>
              </div>
            </div>
          </div>

          <div className="bg-surface p-4 rounded-lg border border-border-subtle/80 shadow-2xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-medium text-content-subtle uppercase tracking-wider">Project Tasks</div>
                <div className="text-xl font-medium text-content-strong mt-0.5">{projectTasksCount}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter & View Mode Control Bar */}
        <div className="bg-surface p-3.5 rounded-lg border border-border-subtle/80 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-content-subtle" />
            <input 
              type="text" 
              placeholder="Search for name, designation, or email..." 
              value={teamSearch} 
              onChange={(e) => setTeamSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-surface-sunken border border-border-subtle rounded-md text-xs focus:ring-1 focus:ring-indigo-500 focus:bg-surface outline-none text-content-body font-medium transition-all"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <div className="relative min-w-[140px]">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full pl-3 pr-8 py-1.5 bg-surface-sunken border border-border-subtle rounded-md outline-none text-content-body font-medium text-xs cursor-pointer appearance-none"
              >
                <option value="all">Semua Role</option>
                <option value="admin">Admin</option>
                <option value="project manager">Project Manager</option>
                <option value="system analyst">System Analyst</option>
                <option value="developer">Developer</option>
                <option value="ui/ux">UI/UX Designer</option>
                <option value="qa">QA Engineer</option>
                <option value="viewer">Viewer</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-content-subtle absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Grid vs List View Mode Buttons */}
            <div className="flex bg-surface-muted p-0.5 rounded-md border border-border-subtle/80">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-content-muted hover:text-content-strong'}`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-content-muted hover:text-content-strong'}`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleExportTeamCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-muted hover:bg-slate-200 text-content-body border border-border-subtle rounded-md text-xs font-medium shadow-2xs transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Container for Card Grid or List */}
      <div className="flex-1 overflow-y-auto pb-6 space-y-5 pr-1 mt-3">
        {/* Grid View Mode - Match Velzon Team Cards */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredPeople.map((person: any, i) => {
              const name = person?.displayName || person?.email || 'Unknown Member';
              const initialsMatch = name.match(/\b\w/g);
              const initials = (initialsMatch ? initialsMatch.join('') : name.substring(0, 2)).substring(0, 2).toUpperCase();
              const roleName = selectedProject?.memberRoles?.[person.uid] || person?.role || 'Team Member';
              const userAssignedTasks = getUserTasks(person);
              const completedTasks = userAssignedTasks.filter(t => {
                const st = String(t.status || '').toUpperCase();
                return st === 'DONE' || st === 'SELESAI' || st === 'COMPLETED' || st === 'FINISH';
              });
              const isOwner = selectedProject?.ownerId === person.uid || selectedProject?.ownerId === person.id;

              return (
                <div 
                  key={person.uid || i} 
                  className="bg-surface rounded-lg border border-border-subtle/80 shadow-2xs overflow-hidden flex flex-col hover:border-indigo-300 transition-all duration-200 group"
                >
                  {/* Banner Header */}
                  <div className="h-16 bg-gradient-to-r from-slate-700 via-indigo-950 to-slate-900 relative p-2.5 flex items-start justify-end">
                    <Star className="w-4 h-4 text-white/40 hover:text-amber-300 cursor-pointer transition-colors" />
                  </div>

                  {/* Avatar Centered Overlap */}
                  <div className="relative -mt-8 mx-auto z-10">
                    <UserAvatar user={person} className="w-16 h-16 border-4 border-white shadow-md text-base" />
                    <div 
                      className={`w-3.5 h-3.5 rounded-full border-2 border-white absolute bottom-0 right-0 shadow-2xs ${
                        person.isPending ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                    />
                  </div>

                  {/* Name & Role */}
                  <div className="p-4 pt-2 text-center flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-medium text-content-strong text-sm leading-snug truncate group-hover:text-indigo-600 transition-colors">
                        {name}
                      </h3>
                      <p className="text-xs font-medium text-content-muted capitalize mt-0.5 truncate">
                        {isOwner ? 'Project Owner & Manager' : roleName}
                      </p>
                    </div>

                    <div className="border-t border-border-faint my-3 pt-3 grid grid-cols-2 gap-2 text-center">
                      <div className="bg-surface-sunken p-2 rounded-md border border-border-faint">
                        <span className="block font-medium text-content-strong text-sm">{userAssignedTasks.length}</span>
                        <span className="text-[10px] text-content-subtle font-medium uppercase tracking-wider">Assigned</span>
                      </div>
                      <div className="bg-surface-sunken p-2 rounded-md border border-border-faint">
                        <span className="block font-medium text-content-strong text-sm">{completedTasks.length}</span>
                        <span className="text-[10px] text-content-subtle font-medium uppercase tracking-wider">Done</span>
                      </div>
                    </div>

                    {/* View Profile Button Only */}
                    <button
                      onClick={() => setSelectedProfileUser(person)}
                      className="w-full py-2 bg-surface-muted hover:bg-indigo-50 hover:text-indigo-600 text-content-body text-xs font-medium rounded-md transition-colors border border-border-subtle/70 shadow-2xs cursor-pointer"
                    >
                      View Profile
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* List View Mode - Sleek Table / Cards */}
        {viewMode === 'list' && (
          <div className="bg-surface rounded-lg border border-border-subtle/80 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-sunken/80 border-b border-border-subtle/80 text-[11px] font-medium text-content-muted uppercase tracking-wider">
                    <th className="px-5 py-3">Member</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3 text-center">Assigned Tasks</th>
                    <th className="px-5 py-3 text-center">Completed</th>
                    <th className="px-5 py-3 text-center">Status</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-faint">
                  {filteredPeople.map((person: any, i) => {
                    const name = person?.displayName || person?.email || 'Unknown Member';
                    const initialsMatch = name.match(/\b\w/g);
                    const initials = (initialsMatch ? initialsMatch.join('') : name.substring(0, 2)).substring(0, 2).toUpperCase();
                    const roleName = selectedProject?.memberRoles?.[person.uid] || person?.role || 'Team Member';
                    const userAssignedTasks = getUserTasks(person);
                    const completedTasks = userAssignedTasks.filter(t => {
                      const st = String(t.status || '').toUpperCase();
                      return st === 'DONE' || st === 'SELESAI' || st === 'COMPLETED' || st === 'FINISH';
                    });
                    const isOwner = selectedProject?.ownerId === person.uid || selectedProject?.ownerId === person.id;

                    return (
                      <tr key={person.uid || i} className="hover:bg-surface-sunken/60 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <UserAvatar user={person} className="w-9 h-9 border border-border-subtle text-xs" />
                              <div className={`w-2.5 h-2.5 rounded-full border border-white absolute bottom-0 right-0 ${person.isPending ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                            </div>
                            <div>
                              <div className="font-medium text-content-strong text-xs">{name}</div>
                              <div className="text-[11px] text-content-subtle font-medium">{person?.email || '@' + (person?.username || person.uid)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex px-2.5 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 capitalize">
                            {isOwner ? 'Project Owner' : roleName}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center font-medium text-content-strong text-xs">
                          {userAssignedTasks.length}
                        </td>
                        <td className="px-5 py-3.5 text-center font-medium text-emerald-600 text-xs">
                          {completedTasks.length}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium ${
                            person.isPending ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${person.isPending ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                            {person.isPending ? 'Pending' : 'Active'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => setSelectedProfileUser(person)}
                            className="px-3 py-1 bg-surface-muted hover:bg-indigo-50 hover:text-indigo-600 text-content-body text-xs font-medium rounded-md transition-colors border border-border-subtle/70 shadow-2xs cursor-pointer"
                          >
                            View Profile
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {filteredPeople.length === 0 && (
          <div className="bg-surface rounded-lg border border-border-subtle/80 p-12 text-center text-content-subtle text-xs font-medium">
            Tidak ada anggota tim yang cocok dengan kriteria pencarian.
          </div>
        )}
      </div>

      {/* View Profile Modal (View-Only) */}
      {selectedProfileUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-surface rounded-xl border border-border-subtle shadow-xl max-w-md w-full overflow-hidden text-left">
            {/* Modal Cover */}
            <div className="h-24 bg-gradient-to-r from-slate-800 via-indigo-900 to-slate-900 p-4 flex justify-end">
              <button 
                onClick={() => setSelectedProfileUser(null)}
                className="w-7 h-7 rounded-full bg-surface/20 hover:bg-surface/40 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Detail Content */}
            <div className="p-6 pt-0 relative">
              <div className="-mt-12 mb-4 flex items-end justify-between">
                <UserAvatar user={selectedProfileUser} className="w-20 h-20 border-4 border-white shadow-md text-xl" />
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full border border-emerald-200">
                  Joined Project
                </span>
              </div>

              <h2 className="text-base font-medium text-content-strong">{selectedProfileUser.displayName || 'Anggota Tim'}</h2>
              <p className="text-xs text-content-muted font-medium">{selectedProfileUser.email || '@' + selectedProfileUser.uid}</p>
              
              <div className="mt-4 p-3 bg-surface-sunken rounded-lg border border-border-subtle/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-content-subtle font-medium">Project Role</span>
                  <span className="font-medium text-content-body capitalize">
                    {selectedProject?.memberRoles?.[selectedProfileUser.uid] || selectedProfileUser.role || 'Member'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-content-subtle font-medium">Assigned Tasks</span>
                  <span className="font-medium text-content-body">
                    {getUserTasks(selectedProfileUser).length} Tasks
                  </span>
                </div>
              </div>

              {/* Task list preview */}
              <div className="mt-4">
                <h4 className="text-xs font-medium text-content-body uppercase tracking-wider mb-2">Tugas yang Ditugaskan</h4>
                <div className="max-h-40 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                  {getUserTasks(selectedProfileUser).map(t => (
                    <div key={t.id} className="p-2 bg-surface rounded border border-border-subtle/80 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-mono text-[10px] font-medium text-indigo-600 bg-indigo-50 px-1 rounded">{t.key}</span>
                        <span className="truncate text-content-body font-medium">{t.title}</span>
                      </div>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 bg-surface-muted text-content-secondary rounded shrink-0">{t.status}</span>
                    </div>
                  ))}
                  {getUserTasks(selectedProfileUser).length === 0 && (
                    <p className="text-xs text-content-subtle italic">Belum ada tugas yang ditugaskan ke anggota ini.</p>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedProfileUser(null)}
                  className="px-4 py-1.5 bg-surface-muted hover:bg-slate-200 text-content-body text-xs font-medium rounded-md transition-colors border border-border-subtle cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
