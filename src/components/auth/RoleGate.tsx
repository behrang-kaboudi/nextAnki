"use client";

import type { ReactNode } from "react";

export function RoleGate({
  role,
  children,
  fallback = null,
}: {
  role: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  void role;
  void fallback;
  // Auth is currently disabled: show everything to everyone.
  return children;
}

export function PermissionGate({
  permission,
  children,
  fallback = null,
}: {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  void permission;
  void fallback;
  // Auth is currently disabled: show everything to everyone.
  return children;
}
