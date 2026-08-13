import { format } from 'date-fns';

export const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

export const ensureDate = (dateValue: any): Date => {
  if (!dateValue) return new Date();
  if (dateValue instanceof Date) {
    return isNaN(dateValue.getTime()) ? new Date() : dateValue;
  }
  if (dateValue && typeof dateValue.toDate === 'function') {
     const d = dateValue.toDate();
     return isNaN(d.getTime()) ? new Date() : d;
  }
  const d = new Date(dateValue);
  return isNaN(d.getTime()) ? new Date() : d;
};

export const safeFormat = (dateValue: any, formatStr: string, fallback: string = '-') => {
  try {
    const d = ensureDate(dateValue);
    if (!dateValue || isNaN(d.getTime())) return fallback;
    return format(d, formatStr);
  } catch (e) {
    return fallback;
  }
};

export const humanizeActivityAction = (action?: string, details?: any): string => {
  if (!action) return "melakukan aktivitas sistem";
  const act = action.toLowerCase().trim();

  if (act.includes("sprint_completed") || act.includes("completesprint") || act.includes("sprint completed")) return "menyelesaikan Sprint";
  if (act.includes("sprint_started") || act.includes("startsprint") || act.includes("sprint started")) return "memulai Sprint baru";
  if (act.includes("task_created") || act.includes("create_task") || act.includes("createtask") || act.includes("task created")) return "membuat task baru";
  if (act.includes("status_changed") || act.includes("update_status") || act.includes("updatestatus") || act.includes("status changed")) return "mengubah status task";
  if (act.includes("task_updated") || act.includes("update_task") || act.includes("updatetask") || act.includes("task updated")) return "memperbarui detail task";
  if (act.includes("comment_added") || act.includes("add_comment") || act.includes("addcomment") || act.includes("comment added")) return "menambahkan komentar";
  if (act.includes("avatar_uploaded") || act.includes("upload_avatar") || act.includes("avatar uploaded")) return "memperbarui foto profil";
  if (act.includes("member_added") || act.includes("add_member") || act.includes("member added")) return "menambahkan anggota tim";
  if (act.includes("project_created") || act.includes("create_project") || act.includes("project created")) return "membuat proyek baru";
  if (act.includes("file_uploaded") || act.includes("upload_file") || act.includes("file uploaded")) return "mengunggah dokumen";

  return act.replace(/_/g, " ");
};
