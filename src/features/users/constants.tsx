/**
 * Konstanta deskriptif untuk panel manajemen pengguna.
 *
 * Diekstrak apa adanya dari index.tsx (Fase 3 — Anti-God-Object).
 *
 * Berekstensi .tsx karena ROLE_DESCRIPTIONS memuat elemen ikon (JSX).
 * Selebihnya data murni tanpa state maupun efek samping.
 */

import React from 'react';
import { Award, Eye, ShieldCheck, UserCog, Users } from 'lucide-react';
import type { AppRole } from '../../types';

export const MODULE_DESCRIPTIONS: Record<string, { label: string; desc: string }> = {
  dashboard: {
    label: "Dashboard",
    desc: "Provides a birds-eye summary of active work streams, sprint tasks, progress metrics, and general workspace health."
  },
  meetingNotes: {
    label: "Meeting Notes",
    desc: "Collaborative hub for meeting notes, registering structural discussion points, allocating actions, and tracking choices."
  },
  wiki: {
    label: "Dokumentasi",
    desc: "Collaborative hub for project documentation and knowledge sharing."
  },
  notebooklm: {
    label: "NotebookLM",
    desc: "Grounded AI research assistant, document synthesis, and audio overview powered by Gemini."
  },
  flowchart: {
    label: "Flowchart Editor",
    desc: "Interactive tool for creating, editing, and mapping project workflows and process diagrams."
  },
  list: {
    label: "Issue List",
    desc: "The primary registry for filing bugs, writing user stories, planning tasks, and filtering the complete target workspace."
  },
  sprints: {
    label: "Planning",
    desc: "Used by managers to manage sprint backlogs, schedule targets, adjust milestones, and run planning ceremonies."
  },
  board: {
    label: "Kanban Board",
    desc: "Visual, interactive columns for the active sprint where members pull tasks across In-Progress, Review, and Done stages."
  },
  qa: {
    label: "QA Testing",
    desc: "Manages test scenarios, test cases, and quality assurance workflows for project modules."
  },
  timeline: {
    label: "Roadmap",
    desc: "Interactive Gantt-style planning showing epic schedules, dependencies, and chronological product launches."
  },
  access: {
    label: "Team",
    desc: "Gives managers clear insights into engineer workload factors, role matrices, skill charts, and team member capacity."
  },
  userManagement: {
    label: "User Management",
    desc: "Manages user access, roles, and permissions."
  },
  masterData: {
    label: "Master Data",
    desc: "Manages core system data."
  },
  auditLog: {
    label: "Enterprise Audit",
    desc: "Highly-granular security recording tracking all structural modifications, deletions, updates, and database actions."
  },
  dbExplorer: {
    label: "DB Explorer",
    desc: "Direct database access and exploration tool."
  },
  settings: {
    label: "Integration Settings",
    desc: "Manages Email and WhatsApp integration configurations."
  }
};

export const ROLE_DESCRIPTIONS: Record<AppRole, { label: string; badgeColor: string; icon: React.ReactNode; desc: string }> = {
  admin: {
    label: "Administrator",
    badgeColor: "bg-rose-50 border-rose-200 text-rose-700",
    icon: <ShieldCheck className="w-4 h-4 text-rose-600 shrink-0" />,
    desc: "Bypasses all control gates. Granted complete read, create, update, and delete access in all modules, settings, and team workspaces."
  },
  head: {
    label: "Department Head",
    badgeColor: "bg-purple-50 border-purple-200 text-purple-700",
    icon: <Award className="w-4 h-4 text-purple-600 shrink-0" />,
    desc: "Supervises whole business units. Can browse metrics, collaborate on documentation, review audit screens, and inspect operations."
  },
  manager: {
    label: "Project Manager",
    badgeColor: "bg-blue-50 border-blue-200 text-blue-700",
    icon: <UserCog className="w-4 h-4 text-blue-600 shrink-0" />,
    desc: "Orchestrated to run specific project fields, draft task specs, spin up sprints, review PR checklists, and direct developer assignments."
  },
  user: {
    label: "Standard User",
    badgeColor: "bg-indigo-50 border-indigo-200 text-indigo-700",
    icon: <Users className="w-4 h-4 text-indigo-600 shrink-0" />,
    desc: "The core collaborator. Empowered to write issues, move card lanes, collaborate on discussion points, and assign items to their plate."
  },
  viewer: {
    label: "Observer",
    badgeColor: "bg-surface-muted border-slate-300 text-content-body",
    icon: <Eye className="w-4 h-4 text-content-secondary shrink-0" />,
    desc: "Read-only workspace access. Best suited for clients, corporate stakeholders, or general auditors who need high visibility into work items."
  }
};

export const ACTION_DESCRIPTIONS = {
  read: "Read: View permission to browse, search, and load module entries.",
  create: "Create: Modification privilege to write and add new records.",
  update: "Update: Modification privilege to edit and refine existing entries.",
  delete: "Delete: Destructive privilege to permanently purge data or archive entities."
};

