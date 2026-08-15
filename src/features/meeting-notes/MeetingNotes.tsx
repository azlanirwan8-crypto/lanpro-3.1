import { confirmDeleteAlert, showSuccessAlert } from "../../lib/sweetalert";
import React, { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  ChevronLeft,
  Edit2,
  MessageSquare,
  Calendar,
  ExternalLink,
  Search,
  FileText,
  Video,
  Clock,
  X,
  Eye,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import {
  getMeetings,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  getUsers,
} from "../../services/meetingService";
import { type Meeting, type UserProfile, type AppRole, type UserPermissions } from "../../types";
import { DiscussionPointsTable } from "./DiscussionPointsTable";
import { UserAvatar } from "../../components/ui/UserAvatar";
import { hasPermission } from "../../lib/permissions";
import { downloadMeetingFile, resolveUserId } from "./services/meeting.service";
import { ResponsiveTable } from "../../components/ResponsiveTable";

interface MeetingNotesProps {
  projectId: string;
  userRole: AppRole;
  currentUser: UserProfile | null;
  permissions?: Partial<UserPermissions>;
  projectMembers?: UserProfile[];
  masterData?: any[];
}

export const MeetingNotes: React.FC<MeetingNotesProps> = ({
  projectId,
  userRole,
  currentUser,
  permissions,
  projectMembers = [],
  masterData = [],
}) => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newMeetingLink, setNewMeetingLink] = useState("");
  const [newMeetingDate, setNewMeetingDate] = useState("");
  const [newMeetingTime, setNewMeetingTime] = useState("");
  const [newMeetingFile, setNewMeetingFile] = useState<File | null>(null);
  const [shouldRemoveMeetingFile, setShouldRemoveMeetingFile] = useState(false);
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<"manual" | "ai">("manual");

  const isMeetingAuthor = (meeting: Meeting | null) => {
    if (!meeting || !currentUser) return false;
    const author = String(meeting.authorId || "")
      .trim()
      .toLowerCase();
    const curId = String(currentUser?.id || "")
      .trim()
      .toLowerCase();
    const curUid = String(currentUser?.uid || "")
      .trim()
      .toLowerCase();
    const curUser = String(currentUser?.username || "")
      .trim()
      .toLowerCase();
    const curEmail = String(currentUser?.email || "")
      .trim()
      .toLowerCase();
    const curName = String(currentUser?.name || "")
      .trim()
      .toLowerCase();
    const curDisplay = String(currentUser?.displayName || "")
      .trim()
      .toLowerCase();

    return (
      author !== "" &&
      (author === curId ||
        author === curUid ||
        author === curUser ||
        author === curEmail ||
        author === curName ||
        author === curDisplay)
    );
  };

  const isEditing = !!editingMeeting;
  const isAuthor = isEditing ? isMeetingAuthor(editingMeeting) : true;
  const isUserAdmin = currentUser
    ? ["SADM", "ADMN", "ADMIN"].includes(
        ((currentUser as any).system_role || currentUser.role || "").toUpperCase()
      )
    : false;
  const canModify = !isEditing || isAuthor || isUserAdmin;

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleDownloadMeeting = async (meetingId: string, fName: string) => {
    toast.info("Mengunduh berkas lampiran...");
    try {
      const data = await downloadMeetingFile(projectId, meetingId, resolveUserId(currentUser));
      if (data.status === "success" && data.data && data.data.fileData) {
        const { fileData, fileName } = data.data;
        const link = document.createElement("a");
        link.href = fileData;
        link.download = fileName || fName || "document";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showSuccessAlert("Berhasil!", "Berkas berhasil diunduh.");
      } else {
        toast.error("Berkas lampiran tidak ditemukan.");
      }
    } catch (error: any) {
      toast.error(error.message || "Gagal mengunduh berkas.");
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const itemsPerPage = 8; // adjusted for side-by-side list density

  const currentUserProfile = users.find((u) => u.uid === currentUser?.uid) || currentUser;

  const userRoleStr = currentUser?.role || (currentUser as any)?.system_role || userRole || "user";
  const isAdmin = ["admin", "sadm", "admn"].includes(String(userRoleStr).toLowerCase());
  const currentUserId = currentUser?.id || currentUser?.uid;

  const canDeleteMeeting = (meeting: Meeting) => {
    return isUserAdmin || isMeetingAuthor(meeting);
  };

  const canAdd = hasPermission(userRole, "meetingNotes", "create", false, permissions);

  const filteredMeetings = meetings.filter((m) =>
    m.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredMeetings.length / itemsPerPage);
  const paginatedMeetings = filteredMeetings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    fetchMeetings();
    fetchUsers();
  }, [projectId]);

  useEffect(() => {
    setWorkspaceTab("manual");
  }, [activeMeetingId]);

  const fetchUsers = async () => {
    try {
      const fetchedUsers = await getUsers(currentUser?.uid);
      setUsers(fetchedUsers);
    } catch (error: any) {
      console.error("Failed to fetch users:", error);
      toast.error(error.message || "Failed to load users");
    }
  };

  const fetchMeetings = async () => {
    setLoading(true);
    try {
      const fetchedMeetings = await getMeetings(projectId, currentUser?.uid);
      setMeetings(fetchedMeetings);
    } catch (error: any) {
      console.error("Failed to fetch meetings:", error);
      toast.error(error.message || "Failed to load meetings");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMeeting = async () => {
    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) {
      toast.error("Meeting title cannot be empty.");
      return;
    }
    if (!currentUser) {
      toast.error("Please login first.");
      return;
    }

    const isEdit = !!editingMeeting;
    const isOwner = isEdit ? editingMeeting!.authorId === currentUser.uid : false;
    const permissionAction = isEdit ? "update" : "create";

    if (!hasPermission(userRole, "meetingNotes", permissionAction, isOwner, permissions)) {
      toast.error(`You do not have permission to ${isEdit ? "update" : "add"} the meeting.`);
      return;
    }

    if (!projectId) {
      toast.error("Project ID not found.");
      return;
    }
    setLoading(true);
    try {
      let fileData = null;
      let fileName = shouldRemoveMeetingFile
        ? ""
        : editingMeeting
          ? editingMeeting.fileName || ""
          : "";
      let fileTypeStr = shouldRemoveMeetingFile
        ? ""
        : editingMeeting
          ? editingMeeting.fileType || ""
          : "";

      if (newMeetingFile) {
        if (newMeetingFile.size > 5 * 1024 * 1024) {
          toast.error("Ukuran berkas melebihi batas maksimal 5 MB.");
          setLoading(false);
          return;
        }
        fileData = await fileToBase64(newMeetingFile);
        fileName = newMeetingFile.name;
        fileTypeStr = newMeetingFile.type || "application/octet-stream";
      }

      if (editingMeeting) {
        const payload: Partial<Meeting> = {
          title: trimmedTitle,
          description: newDescription.trim(),
          meetingLink: newMeetingLink.trim(),
        };
        if (newMeetingFile) {
          payload.fileData = fileData;
          payload.fileName = fileName;
          payload.fileType = fileTypeStr;
        } else if (shouldRemoveMeetingFile) {
          payload.fileData = null;
          payload.fileName = "";
          payload.fileType = "";
        }

        await updateMeeting(projectId, editingMeeting.id!, payload, currentUser.uid);
        showSuccessAlert("Berhasil!", "Data catatan rapat berhasil diubah.");
      } else {
        const payload: Partial<Meeting> = {
          projectId,
          title: trimmedTitle,
          description: newDescription.trim(),
          meetingLink: newMeetingLink.trim(),
          authorId: currentUser.uid,
        };
        if (newMeetingFile) {
          payload.fileData = fileData;
          payload.fileName = fileName;
          payload.fileType = fileTypeStr;
        }
        await createMeeting(projectId, trimmedTitle, currentUser.uid, payload, currentUser.uid);
        showSuccessAlert("Berhasil!", "Data catatan rapat berhasil ditambahkan.");
      }
      setNewTitle("");
      setNewDescription("");
      setNewMeetingLink("");
      setNewMeetingFile(null);
      setShouldRemoveMeetingFile(false);
      setIsModalOpen(false);
      setEditingMeeting(null);
      await fetchMeetings();
    } catch (error) {
      console.error("Failed to save meeting:", error);
      toast.error("Failed to save meeting: " + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const startAddMeeting = () => {
    setEditingMeeting(null);
    setNewTitle("");
    setNewDescription("");
    setNewMeetingLink("");
    setNewMeetingFile(null);
    setShouldRemoveMeetingFile(false);
    setIsModalOpen(true);
  };

  const startEdit = (meeting: Meeting) => {
    setEditingMeeting(meeting);
    setNewTitle(meeting.title || "");
    setNewDescription(meeting.description || "");
    setNewMeetingLink(meeting.meetingLink || "");
    setNewMeetingFile(null);
    setShouldRemoveMeetingFile(false);
    setIsModalOpen(true);
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    const isConfirmed = await confirmDeleteAlert(
      "Apakah Anda Yakin?",
      "Data catatan rapat ini akan dihapus secara permanen dan tidak dapat dikembalikan!"
    );
    if (!isConfirmed) return;

    setLoading(true);
    try {
      await deleteMeeting(projectId, meetingId, currentUser?.uid);
      setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
      if (activeMeetingId === meetingId) {
        setActiveMeetingId(null);
      }
      showSuccessAlert("Berhasil!", "Data catatan rapat berhasil dihapus.");
      fetchMeetings();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete meeting.");
    } finally {
      setLoading(false);
    }
  };

  const getAuthorDisplay = (authorId: string) => {
    const list = Array.isArray(users) ? users : [];
    const user = list.find(
      (u) =>
        u &&
        (u.uid === authorId || u.id === authorId || u.username === authorId || u.email === authorId)
    );
    if (!user) {
      if (authorId === "admin") return { name: "Admin Manager", initial: "AM" };
      return { name: authorId || "Unknown", initial: "U" };
    }
    const name = user?.displayName || user?.username || "User";
    const initial = name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
    return { name, initial };
  };

  const formatDate = (date: any) => {
    if (!date) return "-";
    try {
      if (date.toDate && typeof date.toDate === "function") {
        return date.toDate().toLocaleDateString("en-US");
      }
      return new Date(date).toLocaleDateString("en-US");
    } catch (e) {
      return "-";
    }
  };

  const [mobileViewMode, setMobileViewMode] = useState<"list" | "detail">("list");

  const toggleMeeting = (meetingId: string) => {
    setActiveMeetingId(meetingId);
    setMobileViewMode("detail");
  };

  const activeMeeting = meetings.find((m) => m.id === activeMeetingId);

  return (
    <div className="w-full flex-1 flex flex-col p-3 md:p-6 min-h-0 overflow-hidden bg-surface-muted text-left">
      <div className="flex-1 flex flex-col min-h-0 bg-surface border border-border-subtle/80 rounded-lg shadow-soft overflow-hidden">
        {activeMeetingId === null ? (
          /* DATATABLE VIEW */
          <div className="flex-1 flex flex-col min-h-0 bg-surface">
            {/* Table Header / Action Bar */}
            <div className="p-4 md:p-6 border-b border-border-subtle/80 bg-surface flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-lg text-primary shadow-2xs">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-content-strong tracking-tight">
                    Meeting Notes
                  </h3>
                  <p className="text-xs text-content-muted mt-0.5">
                    Kelola catatan rapat proyek, agenda, datetime, dan poin diskusi.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-72">
                  <input
                    type="text"
                    placeholder="Search meetings by title..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full pl-9 pr-3.5 py-2 bg-surface border border-border-subtle rounded-md text-xs placeholder:text-content-subtle outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all text-content-strong shadow-2xs font-medium"
                  />
                  <Search className="w-3.5 h-3.5 text-content-subtle absolute left-3 top-1/2 -translate-y-1/2" />
                </div>

                {canAdd && (
                  <button
                    onClick={startAddMeeting}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary-hover active:bg-primary-active text-white rounded-md text-xs font-medium transition-all shadow-xs cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4" /> Add Meeting
                  </button>
                )}
              </div>
            </div>

            {/* DataTable Container */}
            <div className="flex-1 overflow-x-auto overflow-y-auto m-4 md:m-6 bg-surface rounded-lg border border-border-subtle/80 shadow-2xs">
              <ResponsiveTable className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-primary/5 border-b border-primary/15 text-xs sm:text-[11px] font-medium uppercase tracking-wider text-primary whitespace-nowrap">
                    <th className="py-3 px-4 w-14 text-center">No</th>
                    <th className="py-3 px-4 min-w-[180px] max-w-[260px]">Meeting Title</th>
                    <th className="py-3 px-4 w-44">Datetime Meeting</th>
                    <th className="py-3 px-4 w-40">Meeting Link</th>
                    <th className="py-3 px-4 w-40">Document File</th>
                    <th className="py-3 px-4 w-36">Author</th>
                    <th className="py-3 px-4 min-w-[180px] max-w-[260px]">Description</th>
                    <th className="py-3 px-4 w-28 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-faint text-xs text-content-body">
                  {paginatedMeetings.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-16 text-content-subtle">
                        <div className="w-12 h-12 rounded-lg bg-indigo-50/80 border border-indigo-100 flex items-center justify-center mx-auto mb-3 shadow-2xs">
                          <MessageSquare className="w-6 h-6 text-primary" />
                        </div>
                        <p className="font-medium text-content-strong text-sm">No meetings found</p>
                        <p className="text-xs text-content-subtle mt-1">
                          Create a new meeting or adjust your search keyword.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginatedMeetings.map((meeting, index) => {
                      const srNo = (currentPage - 1) * itemsPerPage + index + 1;
                      const author = getAuthorDisplay(meeting.authorId);
                      return (
                        <tr
                          key={meeting.id}
                          onClick={() => {
                            setActiveMeetingId(meeting.id!);
                            setMobileViewMode("detail");
                          }}
                          className="hover:bg-surface-sunken/70 transition-colors duration-200 group cursor-pointer"
                        >
                          <td className="py-3 px-4 text-center text-content-subtle font-medium">
                            {String(srNo).padStart(2, "0")}
                          </td>
                          <td className="py-3 px-4 font-medium text-content group-hover:text-primary transition-colors">
                            <div className="line-clamp-1">{meeting.title}</div>
                          </td>
                          <td className="py-3 px-4 text-content-muted font-medium">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-content-subtle shrink-0" />
                              <span>{formatDate(meeting.createdAt)}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                            {meeting.meetingLink ? (
                              <a
                                href={
                                  meeting.meetingLink.startsWith("http")
                                    ? meeting.meetingLink
                                    : `https://${meeting.meetingLink}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50/80 text-primary hover:bg-indigo-100 rounded-md font-medium truncate max-w-[150px] transition-all text-xs sm:text-[11px] border border-indigo-100/80"
                                title={meeting.meetingLink}
                              >
                                <Video className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">Join Room</span>
                              </a>
                            ) : (
                              <span className="px-2 py-0.5 bg-surface-muted text-content-muted rounded-md text-xs sm:text-[10px] font-medium">
                                No link
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                            {meeting.fileName ? (
                              <button
                                onClick={() =>
                                  handleDownloadMeeting(meeting.id!, meeting.fileName!)
                                }
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 rounded-md text-xs font-medium transition-all cursor-pointer group/file shadow-2xs"
                                title="Klik untuk mengunduh berkas"
                              >
                                <Download className="w-3.5 h-3.5 shrink-0 text-emerald-600 group-hover/file:scale-110 transition-transform" />
                                <span className="truncate max-w-[140px]">{meeting.fileName}</span>
                              </button>
                            ) : (
                              <span className="text-slate-300 italic text-xs">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-content-body font-medium">
                            <div className="flex items-center gap-2">
                              <UserAvatar
                                uid={meeting.authorId}
                                members={users && users.length > 0 ? users : projectMembers}
                                name={author.name}
                                className="w-6 h-6 text-xs sm:text-[10px]"
                              />
                              <span className="truncate">{author.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-content-muted font-normal">
                            <div className="line-clamp-1 max-w-xs">
                              {meeting.description || (
                                <span className="text-content-subtle text-xs sm:text-[11px] italic">
                                  No description
                                </span>
                              )}
                            </div>
                          </td>
                          <td
                            className="py-3 px-4 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center justify-center gap-1">
                              <button
                                onClick={() => {
                                  setActiveMeetingId(meeting.id!);
                                  setMobileViewMode("detail");
                                }}
                                className="p-1.5 text-content-muted hover:text-primary hover:bg-indigo-50 rounded-md transition-all cursor-pointer"
                                title="View meeting details and discussion points"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {(isUserAdmin || isMeetingAuthor(meeting)) && (
                                <button
                                  onClick={() => startEdit(meeting)}
                                  className="p-1.5 text-content-muted hover:text-primary hover:bg-indigo-50 rounded-md transition-all cursor-pointer"
                                  title="Edit meeting"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              )}
                              {canDeleteMeeting(meeting) && (
                                <button
                                  onClick={() => handleDeleteMeeting(meeting.id!)}
                                  className="p-1.5 text-content-muted hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all cursor-pointer"
                                  title="Delete meeting"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </ResponsiveTable>
            </div>

            {/* Table Footer / Pagination */}
            <div className="px-6 py-3.5 border-t border-border-subtle bg-surface-sunken/60 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-content-muted font-medium">
                Showing {filteredMeetings.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}{" "}
                to {Math.min(currentPage * itemsPerPage, filteredMeetings.length)} of{" "}
                {filteredMeetings.length} entries
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 bg-surface border border-border-subtle text-content-secondary hover:bg-surface-sunken rounded-md text-xs font-medium disabled:opacity-40 transition-colors cursor-pointer shadow-2xs"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1.5 bg-primary text-white rounded-md text-xs font-medium shadow-xs">
                    {currentPage}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 bg-surface border border-border-subtle text-content-secondary hover:bg-surface-sunken rounded-md text-xs font-medium disabled:opacity-40 transition-colors cursor-pointer shadow-2xs"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* DETAIL VIEW */
          <div className="flex-1 flex flex-col min-h-0 bg-surface-sunken/50 w-full">
            {activeMeeting ? (
              <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 md:p-6 space-y-4 animate-in fade-in duration-300">
                {/* Panel 1: Top Actions */}
                <div className="bg-surface border border-border-subtle/80 rounded-lg p-4 flex items-center justify-between shadow-2xs shrink-0">
                  <button
                    onClick={() => setActiveMeetingId(null)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border-subtle hover:bg-surface-sunken rounded-md text-xs font-medium text-content-body transition-all cursor-pointer shadow-2xs"
                  >
                    <ChevronLeft className="w-4 h-4" /> Back to Meeting List
                  </button>

                  <div className="flex items-center gap-2">
                    {activeMeeting.meetingLink && (
                      <a
                        href={
                          activeMeeting.meetingLink.startsWith("http")
                            ? activeMeeting.meetingLink
                            : `https://${activeMeeting.meetingLink}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-md text-xs font-medium transition-all shadow-xs cursor-pointer"
                      >
                        <Video className="w-3.5 h-3.5" /> Join Meeting{" "}
                        <ExternalLink className="w-3 h-3 opacity-80" />
                      </a>
                    )}
                    {(isUserAdmin || isMeetingAuthor(activeMeeting)) && (
                      <button
                        onClick={() => startEdit(activeMeeting)}
                        className="px-3.5 py-1.5 bg-surface border border-border-subtle hover:bg-surface-sunken text-content-body rounded-md text-xs font-medium transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-primary" /> Edit
                      </button>
                    )}
                    {canDeleteMeeting(activeMeeting) && (
                      <button
                        onClick={() => handleDeleteMeeting(activeMeeting.id!)}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-md text-xs font-medium transition-all cursor-pointer border border-rose-200/80 flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    )}
                  </div>
                </div>

                {/* Panel 2: Meeting Context & Agenda */}
                <div className="bg-surface border border-border-subtle/80 rounded-lg p-5 md:p-6 shadow-2xs shrink-0">
                  <h2 className="text-lg md:text-xl font-medium text-content tracking-tight">
                    {activeMeeting.title}
                  </h2>

                  {activeMeeting.description && (
                    <div className="mt-4 p-4 border border-indigo-100/80 bg-indigo-50/30 rounded-lg border-l-4 border-l-primary flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <span className="text-xs sm:text-[10px] font-medium text-primary tracking-wider uppercase block mb-1">
                          Meeting Description / Agenda
                        </span>
                        <div className="flex items-center gap-2 text-xs sm:text-[11px] text-content-muted mb-2 not-italic">
                          <Calendar className="w-3.5 h-3.5 text-content-subtle" />
                          <span className="text-content-secondary font-medium">
                            {formatDate(activeMeeting.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-content-body leading-relaxed whitespace-pre-wrap">
                          {activeMeeting.description}
                        </p>
                      </div>
                      {activeMeeting.fileName && (
                        <button
                          onClick={() =>
                            handleDownloadMeeting(activeMeeting.id!, activeMeeting.fileName!)
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md text-xs font-medium transition-all border border-emerald-200/80 cursor-pointer shadow-2xs shrink-0 self-start sm:self-center"
                          title="Unduh Berkas Lampiran"
                        >
                          <FileText className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="truncate max-w-[140px]">{activeMeeting.fileName}</span>
                          <span className="text-xs sm:text-[10px] bg-emerald-200/60 px-1.5 py-0.5 rounded font-medium">
                            Download
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Panel 3: Discussion Points Table */}
                <div className="bg-surface border border-border-subtle/80 rounded-lg p-5 md:p-6 shadow-2xs flex-1 flex flex-col min-h-0">
                  <DiscussionPointsTable
                    projectId={projectId}
                    meetingId={activeMeeting.id!}
                    userRole={userRole}
                    currentUser={currentUser}
                    permissions={permissions}
                    projectMembers={projectMembers}
                    masterData={masterData}
                  />
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* POPUP MODAL: Add / Edit Meeting */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-surface p-5 sm:p-6 rounded-lg shadow-xl w-full max-w-lg border border-border-subtle text-left relative">
            <button
              onClick={() => {
                setIsModalOpen(false);
                setEditingMeeting(null);
                setNewTitle("");
                setNewDescription("");
                setNewMeetingLink("");
                setNewMeetingDate("");
                setNewMeetingTime("");
                setSelectedAttendees([]);
              }}
              className="absolute top-4 right-4 sm:top-5 sm:right-5 p-1.5 text-content-subtle hover:text-content-body hover:bg-surface-muted rounded-md transition-all cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5 pr-10">
              <div className="w-9 h-9 rounded-md bg-indigo-50 border border-indigo-100 flex items-center justify-center text-primary shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-medium text-content tracking-tight">
                  {editingMeeting ? "Edit Meeting Note" : "Create New Meeting Note"}
                </h3>
              </div>
            </div>

            <div className="space-y-4 mb-5">
              <div>
                <label className="block text-content-body font-medium text-xs tracking-wider uppercase mb-1.5">
                  Meeting Title <span className="text-rose-500">*</span>
                </label>
                <input
                  disabled={!canModify}
                  className="w-full px-3.5 py-2 bg-surface disabled:bg-surface-sunken disabled:text-content-muted border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-md text-xs font-medium text-content-strong outline-none transition-all placeholder:text-content-subtle shadow-2xs"
                  placeholder="e.g., Sprint 4 Planning & Architecture Review"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-content-body font-medium text-xs tracking-wider uppercase mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-content-subtle" />
                    Meeting Date
                  </label>
                  <input
                    type="date"
                    disabled={!canModify}
                    className="w-full px-3.5 py-2 bg-surface disabled:bg-surface-sunken disabled:text-content-muted border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-md text-xs font-medium text-content-strong outline-none transition-all shadow-2xs cursor-pointer"
                    value={newMeetingDate}
                    onChange={(e) => setNewMeetingDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-content-body font-medium text-xs tracking-wider uppercase mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-content-subtle" />
                    Meeting Time
                  </label>
                  <input
                    type="time"
                    disabled={!canModify}
                    className="w-full px-3.5 py-2 bg-surface disabled:bg-surface-sunken disabled:text-content-muted border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-md text-xs font-medium text-content-strong outline-none transition-all shadow-2xs cursor-pointer"
                    value={newMeetingTime}
                    onChange={(e) => setNewMeetingTime(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-content-body font-medium text-xs tracking-wider uppercase mb-1.5 flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-content-subtle" />
                  Meeting Link
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-content-subtle">
                    <Video className="w-4 h-4" />
                  </div>
                  <input
                    disabled={!canModify}
                    className="w-full pl-9 pr-3.5 py-2 bg-surface disabled:bg-surface-sunken disabled:text-content-muted border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-md text-xs font-medium text-content-strong outline-none transition-all placeholder:text-content-subtle shadow-2xs"
                    placeholder="https://zoom.us/j/... or Google Meet"
                    value={newMeetingLink}
                    onChange={(e) => setNewMeetingLink(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-content-body font-medium text-xs tracking-wider uppercase mb-1.5">
                  Description / Agenda
                </label>
                <textarea
                  disabled={!canModify}
                  className="w-full px-3.5 py-2 bg-surface disabled:bg-surface-sunken disabled:text-content-muted border border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-md text-xs font-medium text-content-strong outline-none transition-all resize-none min-h-[80px] placeholder:text-content-subtle shadow-2xs"
                  placeholder="Outline key discussion topics..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>

              {/* Upload Document Section */}
              <div>
                <label className="block text-content-body font-medium text-xs tracking-wider uppercase mb-1.5 flex items-center justify-between">
                  <span>Upload Document (PDF, Word, Excel • Max 5MB)</span>
                  {newMeetingFile && canModify && (
                    <button
                      type="button"
                      onClick={() => setNewMeetingFile(null)}
                      className="text-xs sm:text-[10px] text-rose-600 hover:underline font-medium"
                    >
                      Remove
                    </button>
                  )}
                </label>

                <div className="border-2 border-dashed border-border-subtle hover:border-primary rounded-md p-3 text-center bg-surface-sunken/50 transition-all relative">
                  <input
                    type="file"
                    disabled={!canModify}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full disabled:cursor-not-allowed"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 5 * 1024 * 1024) {
                          toast.error("Ukuran berkas maksimal 5 MB.");
                          return;
                        }
                        setNewMeetingFile(file);
                        setShouldRemoveMeetingFile(false);
                      }
                    }}
                  />
                  {newMeetingFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-medium text-content-strong truncate max-w-[200px]">
                        {newMeetingFile.name}
                      </span>
                      <span className="text-xs sm:text-[10px] text-content-subtle">
                        ({(newMeetingFile.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                  ) : editingMeeting?.fileName && !shouldRemoveMeetingFile ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-4 h-4 text-primary" />
                        <span className="text-xs font-medium text-content-strong truncate max-w-[180px]">
                          {editingMeeting.fileName}
                        </span>
                        <span className="text-xs sm:text-[10px] text-content-subtle">
                          (Existing)
                        </span>
                      </div>
                      {canModify && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShouldRemoveMeetingFile(true);
                          }}
                          className="text-xs sm:text-[10px] bg-rose-50 hover:bg-rose-100 text-rose-700 px-2 py-1 rounded font-medium transition-all"
                        >
                          Hapus Berkas
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-content-secondary">
                        Klik atau seret berkas ke sini untuk upload
                      </p>
                      <p className="text-xs sm:text-[10px] text-content-subtle">
                        PDF, Word (.doc, .docx), Excel (.xls, .xlsx) hingga 5MB
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border-faint">
              <button
                type="button"
                className="px-4 py-2 text-xs font-medium text-content-secondary hover:bg-surface-muted rounded-md transition-all cursor-pointer"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingMeeting(null);
                  setNewTitle("");
                  setNewDescription("");
                  setNewMeetingLink("");
                  setNewMeetingDate("");
                  setNewMeetingTime("");
                  setSelectedAttendees([]);
                }}
              >
                Close
              </button>
              {!canModify ? (
                <div className="text-xs font-medium text-rose-600 flex items-center gap-1.5 bg-rose-50 px-3.5 py-2 rounded-md border border-rose-100 shadow-2xs">
                  <Eye className="w-4 h-4 text-rose-500" />
                  <span>Mode Baca Saja (Bukan Author/Admin)</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleCreateMeeting}
                  disabled={loading || !newTitle.trim()}
                  className="px-5 py-2 bg-primary hover:bg-primary-hover active:bg-primary-active disabled:opacity-50 text-white rounded-md text-xs font-medium shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Meeting</span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
