import { NextResponse } from "next/server";

import { normalizeIpaForDb } from "@/lib/ipa/normalize";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const computeNormalized = (ipa: string) => normalizeIpaForDb(ipa, 2000);

type PictureWordInput = {
  fa: string;
  ipa_fa: string;
  phinglish: string;
  en: string;
  type:
    | "noun"
    | "adding"
    | "animal"
    | "person"
    | "notPersonal"
    | "humanBody"
    | "relationalObj"
    | "personAdj"
    | "personAdj_adj"
    | "adj"
    | "food"
    | "place"
    | "accessory"
    | "tool";
  canBePersonal: boolean;
  ipaVerified: boolean;
};

type PictureWordUpdate = {
  id: number;
  data: Partial<PictureWordInput>;
  meta?: { invalidType?: boolean };
};

type PictureWordUpdateField = keyof PictureWordInput;

type RejectedRow = {
  item: unknown;
  reason: string;
};

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function normalizeInput(value: unknown): string {
  return isString(value) ? value.trim() : "";
}

function normalizeOptionalString(value: unknown): string | undefined {
  const normalized = normalizeInput(value);
  return normalized ? normalized : undefined;
}

function normalizeFa(value: string) {
  return value.replace(/\u200c/g, " ").replace(/\s+/g, " ").trim();
}

function isPersianFa(value: string) {
  const normalized = normalizeFa(value);
  if (!/[\u0600-\u06FF]/.test(normalized)) return false;
  return /^[\u0600-\u06FF\s]+$/.test(normalized);
}

function hasPersianLetters(value: string) {
  return /[\u0600-\u06FF]/.test(value);
}

function parseCanBePersonal(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  if (typeof value === "bigint") return value > 0n;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    if (!s) return false;
    if (s === "true") return true;
    if (s === "false") return false;
    const n = Number(s);
    if (Number.isFinite(n)) return n > 0;
    return false;
  }
  return false;
}

function toPictureWordInput(value: unknown): PictureWordInput | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const fa = normalizeFa(normalizeInput(obj.fa));
  const ipa_fa = normalizeInput(obj.ipa_fa);
  const phinglish = normalizeInput(obj.phinglish);
  const en = normalizeInput(obj.en);
	  const typeRaw = normalizeInput(obj.type).toLowerCase();
		  const type =
		    typeRaw === "noun"
		      ? "noun"
		      : typeRaw === "adding"
		        ? "adding"
		        : typeRaw === "animal"
		          ? "animal"
		          : typeRaw === "person"
		            ? "person"
		            : typeRaw === "notpersonal"
		              ? "notPersonal"
		              : typeRaw === "humanbody"
		                ? "humanBody"
		                : typeRaw === "relationalobj"
		                  ? "relationalObj"
		            : typeRaw === "personadj"
		              ? "personAdj"
		              : typeRaw === "personadj_adj"
		                ? "personAdj_adj"
		                : typeRaw === "adj"
	                  ? "adj"
	            : typeRaw === "food"
	              ? "food"
	              : typeRaw === "place"
	                ? "place"
	                : typeRaw === "accessory"
	                  ? "accessory"
	                  : typeRaw === "tool"
	                    ? "tool"
	            : "";
  if (typeRaw && !type) return null;
  const ipaVerified = Boolean(obj.ipaVerified);
  const canBePersonal = parseCanBePersonal(obj.canBePersonal);

  if (!fa || !ipa_fa || !phinglish || !en) return null;
  return {
    fa,
    ipa_fa,
    phinglish,
    en,
    type: (type || "noun") as PictureWordInput["type"],
    canBePersonal,
    ipaVerified,
  };
}

function toPictureWordUpdate(value: unknown): PictureWordUpdate | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const id = Number(obj.id);
  if (!Number.isFinite(id)) return null;

  const faRaw = normalizeOptionalString(obj.fa);
  const fa = faRaw ? normalizeFa(faRaw) : undefined;
  const ipa_fa = normalizeOptionalString(obj.ipa_fa);
  const phinglish = normalizeOptionalString(obj.phinglish);
  const en = normalizeOptionalString(obj.en);

	  const typeRaw = normalizeOptionalString(obj.type)?.toLowerCase();
		  const type =
		    typeRaw === "noun"
		      ? "noun"
		      : typeRaw === "adding"
		        ? "adding"
		        : typeRaw === "animal"
		          ? "animal"
		          : typeRaw === "person"
		            ? "person"
		            : typeRaw === "notpersonal"
		              ? "notPersonal"
		              : typeRaw === "humanbody"
		                ? "humanBody"
		                : typeRaw === "relationalobj"
		                  ? "relationalObj"
		            : typeRaw === "personadj"
		              ? "personAdj"
		              : typeRaw === "personadj_adj"
		                ? "personAdj_adj"
		                : typeRaw === "adj"
	                  ? "adj"
	            : typeRaw === "food"
	              ? "food"
	              : typeRaw === "place"
	                ? "place"
	                : typeRaw === "accessory"
                  ? "accessory"
                  : typeRaw === "tool"
                    ? "tool"
            : undefined;
  const invalidType = Boolean(typeRaw && !type);

  const hasCanBePersonal = Object.prototype.hasOwnProperty.call(obj, "canBePersonal");
  const canBePersonal = hasCanBePersonal ? parseCanBePersonal(obj.canBePersonal) : undefined;
  const ipaVerified = typeof obj.ipaVerified === "boolean" ? obj.ipaVerified : undefined;

  const data: Partial<PictureWordInput> = {};
  if (fa) data.fa = fa;
  if (ipa_fa) data.ipa_fa = ipa_fa;
  if (phinglish) data.phinglish = phinglish;
  if (en) data.en = en;
  if (type) data.type = type;
  if (typeof canBePersonal === "boolean") data.canBePersonal = canBePersonal;
  if (typeof ipaVerified === "boolean") data.ipaVerified = ipaVerified;

  if (Object.keys(data).length === 0) return null;
  return { id, data, meta: invalidType ? { invalidType: true } : undefined };
}

function filterUpdateData(
  data: Partial<PictureWordInput>,
  updateFields: PictureWordUpdateField[] | null
): Partial<PictureWordInput> {
  if (!updateFields?.length) return data;
  const allowed = new Set(updateFields);
  const filtered: Partial<PictureWordInput> = {};
  for (const [key, value] of Object.entries(data) as Array<[PictureWordUpdateField, unknown]>) {
    if (!allowed.has(key)) continue;
    (filtered as Record<string, unknown>)[key] = value;
  }
  return filtered;
}

function parseUpdateFields(value: unknown): PictureWordUpdateField[] | null {
  if (!Array.isArray(value)) return null;
  const allowed: PictureWordUpdateField[] = [
    "fa",
    "ipa_fa",
    "phinglish",
    "en",
    "type",
    "canBePersonal",
    "ipaVerified",
  ];
  const allowedSet = new Set(allowed);
  const fields: PictureWordUpdateField[] = [];
  for (const item of value) {
    if (!isString(item)) continue;
    const key = item as PictureWordUpdateField;
    if (!allowedSet.has(key)) continue;
    fields.push(key);
  }
  return [...new Set(fields)];
}

function validatePictureWordInput(row: PictureWordInput): string | null {
  if (!isPersianFa(row.fa)) return "fa must contain only Persian letters and spaces";
  if (hasPersianLetters(row.ipa_fa)) return "ipa_fa must not contain Persian letters";
  if (hasPersianLetters(row.phinglish)) return "phinglish must not contain Persian letters";
  if (hasPersianLetters(row.en)) return "en must not contain Persian letters";
  return null;
}

function hasInvalidType(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  const typeRaw = normalizeOptionalString(obj.type)?.toLowerCase();
  if (!typeRaw) return false;
	  return (
	    typeRaw !== "noun" &&
	    typeRaw !== "adding" &&
	    typeRaw !== "animal" &&
	    typeRaw !== "person" &&
	    typeRaw !== "notpersonal" &&
	    typeRaw !== "humanbody" &&
	    typeRaw !== "relationalobj" &&
	    typeRaw !== "personadj" &&
	    typeRaw !== "personadj_adj" &&
	    typeRaw !== "adj" &&
	    typeRaw !== "food" &&
	    typeRaw !== "place" &&
	    typeRaw !== "accessory" &&
	    typeRaw !== "tool"
	  );
}

function validateUpdate(update: PictureWordUpdate): string | null {
  if (update.meta?.invalidType)
    return "type must be one of: noun, adding, animal, person, notPersonal, humanBody, relationalObj, personAdj, personAdj_adj, adj, food, place, accessory, tool";
  const { data } = update;
  if (data.fa && !isPersianFa(data.fa)) return "fa must contain only Persian letters and spaces";
  if (data.ipa_fa && hasPersianLetters(data.ipa_fa)) return "ipa_fa must not contain Persian letters";
  if (data.phinglish && hasPersianLetters(data.phinglish)) return "phinglish must not contain Persian letters";
  if (data.en && hasPersianLetters(data.en)) return "en must not contain Persian letters";
  return null;
}

export async function GET() {
  const rows = await prisma.pictureWord.findMany({
    orderBy: [{ fa: "asc" }, { en: "asc" }],
    select: {
      id: true,
      fa: true,
      ipa_fa: true,
      phinglish: true,
      en: true,
      type: true,
      canBePersonal: true,
      ipaVerified: true,
    },
  });

  return NextResponse.json({ rows });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const objBody = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const items = Array.isArray(objBody?.items) ? objBody?.items : null;
  const updateFields = parseUpdateFields(objBody?.updateFields);

  if (items) {
    body = items;
  }

  if (!Array.isArray(body)) {
    const asUpdate = toPictureWordUpdate(body);
	    if (asUpdate) {
	      const data = filterUpdateData(asUpdate.data, updateFields);
      if (!Object.keys(data).length) {
        return NextResponse.json({ error: "No selected fields to update" }, { status: 400 });
      }
      const finalUpdate: PictureWordUpdate = { id: asUpdate.id, data };
      const validationError = validateUpdate(asUpdate);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }

	      try {
        const updated = await prisma.pictureWord.update({
          where: { id: finalUpdate.id },
          data:
            typeof finalUpdate.data.ipa_fa === "string"
              ? {
                  ...finalUpdate.data,
                  ipa_fa_normalized: computeNormalized(finalUpdate.data.ipa_fa),
                }
              : finalUpdate.data,
          select: {
            id: true,
            fa: true,
            ipa_fa: true,
            phinglish: true,
            en: true,
            type: true,
            canBePersonal: true,
            ipaVerified: true,
          },
        });
        return NextResponse.json({ row: updated, updated: 1 });
      } catch (error) {
        const code = (error as { code?: string } | null)?.code;
        if (code === "P2025") {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        if (code === "P2002") {
          return NextResponse.json({ error: "Duplicate (fa + en)" }, { status: 409 });
        }
        throw error;
      }
    }

    const row = toPictureWordInput(body);
      if (!row) {
        if (hasInvalidType(body)) {
          return NextResponse.json(
          { error: "type must be one of: noun, adding, animal, person, notPersonal, humanBody, relationalObj, personAdj, personAdj_adj, adj, food, place, accessory, tool" },
          { status: 400 },
        );
        }
        return NextResponse.json({ error: "Invalid object body" }, { status: 400 });
      }
    const validationError = validatePictureWordInput(row);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

	    try {
      const created = await prisma.pictureWord.create({
        data: { ...row, ipa_fa_normalized: computeNormalized(row.ipa_fa) },
        select: {
          id: true,
          fa: true,
          ipa_fa: true,
          phinglish: true,
          en: true,
          type: true,
          canBePersonal: true,
          ipaVerified: true,
        },
      });
      return NextResponse.json({ row: created });
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === "P2002") {
        return NextResponse.json({ error: "Duplicate (fa + en)" }, { status: 409 });
      }
      throw error;
    }
  }

  const rows: Array<PictureWordInput & { ipa_fa_normalized: string }> = [];
  const updatesById: Array<PictureWordUpdate & { providedFa?: string }> = [];
  let skipped = 0;
  let unchanged = 0;
  let updated = 0;
  const rejected: RejectedRow[] = [];
  for (const item of body) {
    const update = toPictureWordUpdate(item);
    if (update) {
      const itemObj = item as Record<string, unknown>;
      const providedFaRaw = normalizeOptionalString(itemObj.fa);
      const providedFa = providedFaRaw ? normalizeFa(providedFaRaw) : undefined;
      const meta = update.meta;
      const data = filterUpdateData(update.data, updateFields);
      if (!Object.keys(data).length) {
        if (meta?.invalidType) {
          rejected.push({
            item,
            reason: "type must be one of: noun, adding, animal, person, notPersonal, humanBody, relationalObj, personAdj, personAdj_adj, adj, food, place, accessory, tool",
          });
          continue;
        }
        rejected.push({ item, reason: "No selected fields to update" });
        continue;
      }
      const candidate: PictureWordUpdate = { id: update.id, data, meta };
      const validationError = validateUpdate(candidate);
      if (validationError) {
        rejected.push({ item, reason: validationError });
        continue;
      }
      updatesById.push({ ...candidate, providedFa });
      continue;
    }

    const row = toPictureWordInput(item);
	    if (!row) {
	      if (hasInvalidType(item)) {
	        rejected.push({
	          item,
	          reason:
	            "type must be one of: noun, adding, animal, person, notPersonal, humanBody, relationalObj, personAdj, personAdj_adj, adj, food, place, accessory, tool",
	        });
	      } else {
	        skipped += 1;
	      }
      continue;
    }
    const validationError = validatePictureWordInput(row);
    if (validationError) {
      rejected.push({ item, reason: validationError });
      continue;
    }
    rows.push({ ...row, ipa_fa_normalized: computeNormalized(row.ipa_fa) });
  }

  for (const update of updatesById) {
    if (update.providedFa) {
      const existing = await prisma.pictureWord.findUnique({
        where: { id: update.id },
        select: { id: true, fa: true },
      });
      if (!existing) {
        rejected.push({ item: { id: update.id, ...update.data }, reason: "Not found" });
        continue;
      }
      if (normalizeFa(existing.fa) !== update.providedFa) {
        rejected.push({
          item: { id: update.id, fa: update.providedFa, ...update.data },
          reason: "id does not match fa",
        });
        continue;
      }
    }

    try {
	      const existing = await prisma.pictureWord.findUnique({
	        where: { id: update.id },
	        select: {
	          id: true,
	          fa: true,
	          ipa_fa: true,
	          canBePersonal: true,
	          phinglish: true,
	          en: true,
	          type: true,
	          ipaVerified: true,
	        },
      });
      if (!existing) {
        rejected.push({ item: { id: update.id, ...update.data }, reason: "Not found" });
        continue;
      }

	      const hasChanges =
	        (update.data.fa !== undefined && update.data.fa !== existing.fa) ||
	        (update.data.ipa_fa !== undefined && update.data.ipa_fa !== existing.ipa_fa) ||
	        (update.data.canBePersonal !== undefined && update.data.canBePersonal !== existing.canBePersonal) ||
	        (update.data.phinglish !== undefined && update.data.phinglish !== existing.phinglish) ||
	        (update.data.en !== undefined && update.data.en !== existing.en) ||
	        (update.data.type !== undefined && update.data.type !== existing.type) ||
	        (update.data.ipaVerified !== undefined && update.data.ipaVerified !== existing.ipaVerified);

      if (!hasChanges) {
        unchanged += 1;
        continue;
      }

      await prisma.pictureWord.update({
        where: { id: update.id },
        data:
          typeof update.data.ipa_fa === "string"
            ? { ...update.data, ipa_fa_normalized: computeNormalized(update.data.ipa_fa) }
            : update.data,
      });
      updated += 1;
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === "P2025") {
        rejected.push({ item: { id: update.id, ...update.data }, reason: "Not found" });
        continue;
      }
      if (code === "P2002") {
        rejected.push({ item: { id: update.id, ...update.data }, reason: "Duplicate (fa + en)" });
        continue;
      }
      throw error;
    }
  }

  if (rows.length === 0) {
    return NextResponse.json({
      inserted: 0,
      updated,
      unchanged,
      skipped,
      rejected,
      total: body.length,
      prepared: 0,
    });
  }

  const result = await prisma.pictureWord.createMany({
    data: rows,
    skipDuplicates: true,
  });

  return NextResponse.json({
    inserted: result.count,
    updated,
    unchanged,
    skipped,
    rejected,
    total: body.length,
    prepared: rows.length,
  });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const idRaw = url.searchParams.get("id");
  const id = Number(idRaw);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await prisma.pictureWord.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const obj = (body && typeof body === "object" ? (body as Record<string, unknown>) : null) as
    | Record<string, unknown>
    | null;
  const id = Number(obj?.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const faRaw = normalizeOptionalString(obj?.fa);
  const fa = faRaw ? normalizeFa(faRaw) : undefined;
  const ipa_fa = normalizeOptionalString(obj?.ipa_fa);
  const phinglish = normalizeOptionalString(obj?.phinglish);
  const hasCanBePersonal = Object.prototype.hasOwnProperty.call(
    obj ?? {},
    "canBePersonal",
  );
  const canBePersonal = hasCanBePersonal
    ? parseCanBePersonal(obj?.canBePersonal)
    : undefined;

  const isVerifying = Boolean(ipa_fa || phinglish);
  if (isVerifying && (!ipa_fa || !phinglish)) {
    return NextResponse.json(
      { error: "When updating IPA, both `ipa_fa` and `phinglish` are required" },
      { status: 400 },
    );
  }

  if (
    !fa &&
    !ipa_fa &&
    !phinglish &&
    typeof canBePersonal !== "boolean"
  ) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (fa) data.fa = fa;
  if (typeof canBePersonal === "boolean") data.canBePersonal = canBePersonal;
  if (ipa_fa) {
    data.ipa_fa = ipa_fa;
    data.ipa_fa_normalized = computeNormalized(ipa_fa);
  }
  if (phinglish) data.phinglish = phinglish;
  if (isVerifying) data.ipaVerified = true;

  const updated = await prisma.pictureWord.update({
    where: { id },
    data,
    select: {
      id: true,
      fa: true,
      ipa_fa: true,
      phinglish: true,
      en: true,
      type: true,
      canBePersonal: true,
      ipaVerified: true,
    },
  });

  return NextResponse.json({ row: updated });
}
