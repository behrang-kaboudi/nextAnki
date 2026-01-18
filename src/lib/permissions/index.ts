export function hasRole(roles: string[] | undefined, role: string) {
  return Boolean(roles?.includes(role));
}

export function hasPermission(permissions: string[] | undefined, permission: string) {
  return Boolean(permissions?.includes(permission));
}

