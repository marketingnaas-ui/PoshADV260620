import {
  Users,
  FolderKanban,
  Tags,
  Shield,
  KeyRound,
  Workflow,
  Brain,
  MessageCircle,
  Sheet,
  FileText,
  Hash,
  DatabaseBackup,
  Activity,
  ScrollText,
} from "lucide-react";

export const SETTINGS_MENU = [
  {
    section: "ORGANIZATION",
    items: [
      {
        id: "staff-directory",
        label: "Staff Directory",
        icon: Users,
        path: "/settings/staff-directory",
      },
      {
        id: "project-settings",
        label: "Project Settings",
        icon: FolderKanban,
        path: "/settings/project-settings",
      },
      {
        id: "categories",
        label: "Categories",
        icon: Tags,
        path: "/settings/categories",
      },
    ],
  },
  {
    section: "SECURITY",
    items: [
      {
        id: "access-control",
        label: "Access Control",
        icon: Shield,
        path: "/settings/access-control",
      },
      {
        id: "pin-full-access",
        label: "PIN & Full Access",
        icon: KeyRound,
        path: "/settings/pin-full-access",
      },
      {
        id: "approval-workflow",
        label: "Approval Workflow",
        icon: Workflow,
        path: "/settings/approval-workflow",
      },
    ],
  },
  {
    section: "AI & INTEGRATION",
    items: [
      {
        id: "ai-control",
        label: "AI Control Center",
        icon: Brain,
        path: "/settings/ai-control",
      },
      {
        id: "line-integration",
        label: "LINE Messaging API",
        icon: MessageCircle,
        path: "/settings/line-integration",
      },
      {
        id: "google-sheet-sync",
        label: "Google Sheets Sync",
        icon: Sheet,
        path: "/settings/google-sheet-sync",
      },
    ],
  },
  {
    section: "SYSTEM",
    items: [
      {
        id: "document-templates",
        label: "Document Templates",
        icon: FileText,
        path: "/settings/document-templates",
      },
      {
        id: "code-management",
        label: "Code Management",
        icon: Hash,
        path: "/settings/code-management",
      },
      {
        id: "backup-restore",
        label: "Backup & Restore",
        icon: DatabaseBackup,
        path: "/settings/backup-restore",
      },
      {
        id: "system-health",
        label: "System Health",
        icon: Activity,
        path: "/settings/system-health",
      },
      {
        id: "audit-center",
        label: "Audit Center",
        icon: ScrollText,
        path: "/settings/audit-center",
      },
    ],
  },
];
