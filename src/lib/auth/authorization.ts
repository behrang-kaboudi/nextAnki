import { auth } from "@/auth";

function withDevAdmin(session: unknown) {
  const s = (session ?? {}) as { user?: Record<string, unknown> };
  const user = (s.user ?? {}) as { id?: unknown; roles?: unknown; permissions?: unknown };
  const roles = Array.isArray(user.roles) ? user.roles.map(String) : [];
  const permissions = Array.isArray(user.permissions) ? user.permissions.map(String) : [];
  return {
    ...s,
    user: {
      ...user,
      id: typeof user.id === "string" && user.id ? user.id : "dev",
      roles: Array.from(new Set(["admin", ...roles])),
      permissions: Array.from(new Set(["*", ...permissions])),
    },
  };
}

export async function requireAuth(options?: { redirectTo?: string }) {
  void options;
  // Auth is currently disabled: treat every request as authenticated admin.
  return withDevAdmin(await auth());
}

export async function requireRole(role: string, options?: { redirectTo?: string }) {
  return requireAuth(options);
}

export async function requirePermission(
  permission: string,
  options?: { redirectTo?: string },
) {
  return requireAuth(options);
}
