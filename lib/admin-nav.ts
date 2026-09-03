import type { Icon } from "@phosphor-icons/react";
import {
  House,
  FileText,
  PlusCircle,
  Tag,
  Image,
  ChatCircleDots,
  ChartLine,
  Globe,
  Users,
  GridFour,
  UsersThree,
  UserPlus,
  Monitor,
  ShieldCheck,
  ChartPie,
  Scroll,
  Key,
  Envelope,
  PaperPlane,
  Gear,
  Plugs,
  Robot,
} from "@phosphor-icons/react";

export interface AdminNavItem {
  href: string;
  label: string;        // sentence case Indonesian ("Dashboard")
  icon: Icon;           // Phosphor icon component
  superAdminOnly?: boolean;
}

export interface AdminNavGroup {
  id: string;
  title: string;        // planner: "Kantor", "Terbit", "Saluran", "Sistem"
  superAdminOnly?: boolean; // groups-level flag applied to ALL items
  items: AdminNavItem[];
}

// Phosphor icons mapped for each route (regular weight)
export const adminNavGroups: AdminNavGroup[] = [
  {
    id: "workspace",
    title: "Kantor",
    items: [
      { href: "/admin", label: "Dashboard", icon: House },
      { href: "/admin/announcements", label: "Pengumuman", icon: FileText },
      { href: "/admin/announcements/new", label: "Buat Baru", icon: PlusCircle },
      { href: "/admin/categories", label: "Kategori", icon: Tag },
      { href: "/admin/media", label: "Media", icon: Image },
      { href: "/admin/comments", label: "Komentar", icon: ChatCircleDots },
    ],
  },
  {
    id: "publish",
    title: "Terbit",
    items: [
      // Per-site content entrypoints live under Terbit, marked by masthead color
      { href: "/admin/analytics", label: "Analytics", icon: ChartLine },
    ],
  },
  {
    id: "channels",
    title: "Saluran",
    superAdminOnly: true, // groups-level flag applied to ALL items
    items: [
      { href: "/admin/sites", label: "Sites", icon: Globe },
      { href: "/admin/users", label: "Pengguna", icon: Users },
      { href: "/admin/portal-apps", label: "Portal Apps", icon: GridFour },
      { href: "/admin/portal-groups", label: "Portal Groups", icon: UsersThree },
      { href: "/admin/portal-users", label: "Portal Users", icon: UserPlus },
      { href: "/admin/portal-sessions", label: "Portal Sesi", icon: Monitor },
      { href: "/admin/portal-audit", label: "Portal Audit", icon: ShieldCheck },
      { href: "/admin/global-analytics", label: "Global Analytics", icon: ChartPie },
      { href: "/admin/audit-trail", label: "Audit Trail", icon: Scroll },
    ],
  },
  {
    id: "system",
    title: "Sistem",
    items: [
      { href: "/admin/sessions", label: "Sesi", icon: Key },
      { href: "/admin/email", label: "Email", icon: Envelope },
      { href: "/admin/newsletter", label: "Newsletter", icon: PaperPlane },
      { href: "/admin/settings", label: "Pengaturan", icon: Gear },
      { href: "/admin/hris-gateway", label: "HRIS Gateway", icon: Plugs, superAdminOnly: true },
      { href: "/admin/portal-ai", label: "AI Portal", icon: Robot, superAdminOnly: true },
    ],
  },
];

// Active nav item for a pathname (used by sidebar + palette)
export function findActiveAdminItem(pathname: string, groups = adminNavGroups, isSuperAdmin = false): AdminNavItem | null {
  for (const group of groups) {
    if (group.superAdminOnly && !isSuperAdmin) continue;
    for (const item of group.items) {
      if (pathname === item.href) return item;
    }
  }
  return null;
}
