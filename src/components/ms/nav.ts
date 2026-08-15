import type { Role } from "@/lib/ms/types";

export interface NavItem {
  label: string;
  to: string;
}

export const NAV: Record<Role, NavItem[]> = {
  administrator: [
    { label: "Dashboard", to: "/admin" },
    { label: "User Management", to: "/admin/users" },
    { label: "Security Zones", to: "/admin/zones" },
    { label: "Data Sources", to: "/admin/sources" },
    { label: "Vessel Data", to: "/admin/vessels" },
    { label: "Threat Rules", to: "/admin/rules" },
    { label: "System Health", to: "/admin/health" },
    { label: "Audit Logs", to: "/admin/audit" },
    { label: "Analytics", to: "/admin/analytics" },
    { label: "Settings", to: "/admin/settings" },
  ],
  command: [
    { label: "Command Center", to: "/command" },
    { label: "Live Maritime Map", to: "/command/map" },
    { label: "Digital Twin", to: "/command/twin" },
    { label: "Alerts", to: "/command/alerts" },
    { label: "Vessels", to: "/command/vessels" },
    { label: "Threat Analysis", to: "/command/threats" },
    { label: "Incidents", to: "/command/incidents" },
    { label: "Assignments", to: "/command/assignments" },
    { label: "Evidence", to: "/command/evidence" },
    { label: "Analytics", to: "/command/analytics" },
    { label: "Notifications", to: "/notifications" },
    { label: "Profile", to: "/profile" },
  ],
  field: [
    { label: "My Dashboard", to: "/field" },
    { label: "Assignments", to: "/field/assignments" },
    { label: "Mission Map", to: "/field/mission" },
    { label: "Active Incident", to: "/field/active" },
    { label: "Updates", to: "/field/updates" },
    { label: "Evidence", to: "/field/evidence" },
    { label: "Reports", to: "/field/reports" },
    { label: "Notifications", to: "/notifications" },
    { label: "Profile", to: "/profile" },
  ],
};

export const ROLE_LABEL: Record<Role, string> = {
  administrator: "Administrator",
  command: "Command Officer",
  field: "Field Officer",
};

export const HOME: Record<Role, string> = {
  administrator: "/admin",
  command: "/command",
  field: "/field",
};
