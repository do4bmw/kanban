import { OrgRole } from "@prisma/client"

export function canManageOrg(role: OrgRole) {
  return role === "OWNER" || role === "ADMIN"
}
export function canEditCards(role: OrgRole) {
  return role !== "VIEWER"
}
export function canDeleteCards(role: OrgRole) {
  return role === "OWNER" || role === "ADMIN"
}
export function canManageColumns(role: OrgRole) {
  return role === "OWNER" || role === "ADMIN"
}
