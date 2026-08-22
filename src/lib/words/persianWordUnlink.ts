import type { Prisma } from "@prisma/client";

export function removePersianWordIdFromJsonArray(value: Prisma.JsonValue | null, persianWordId: number): Prisma.JsonValue[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item) => item !== persianWordId && item !== String(persianWordId));
}
