import { auth } from "@/auth";
import { hasPermission, hasRole } from "@/lib/permissions";

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

export type ApiAuthOk = { ok: true; session: ReturnType<typeof withDevAdmin> };
export type ApiAuthError = { ok: false; status: number };
export type ApiAuthResult = ApiAuthOk | ApiAuthError;

export async function requireApiAuth(): Promise<ApiAuthResult> {
  // Auth is currently disabled: treat every request as an authenticated admin.
  const session = withDevAdmin(await auth());
  return { ok: true as const, session };
}

export async function requireApiRole(role: string): Promise<ApiAuthResult> {
  const res = await requireApiAuth();
  if (!res.ok) return res;
  if (!hasRole(res.session.user?.roles, role)) return { ok: false as const, status: 403 as const };
  return res;
}

export async function requireApiPermission(permission: string): Promise<ApiAuthResult> {
  const res = await requireApiAuth();
  if (!res.ok) return res;
  if (!hasPermission(res.session.user?.permissions, permission)) {
    return { ok: false as const, status: 403 as const };
  }
  return res;
}
