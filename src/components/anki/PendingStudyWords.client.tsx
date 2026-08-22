"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ankiOperations } from "@/lib/anki";

const FILTER_KNOWING_DECK = "WordsForNewStudy::FilterKnowing";

type PendingStudyWord = {
  id: number;
  anki_link_id: string;
  base_form: string;
  meaning_fa: string;
  missing_from_database: boolean;
  anki_ready: boolean;
  anki_readiness_issues: Array<{
    field: string;
    reason: "missing" | "invalid";
  }>;
};

type PendingStudyStatus =
  | "incomplete"
  | "not_in_anki"
  | "in_anki_not_filter";

type ResolvedPendingStudyWord = PendingStudyWord & {
  study_status: PendingStudyStatus;
};

function quoteAnkiValue(value: string) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function ankiLinkQueries(ankiLinkId: string) {
  const value = quoteAnkiValue(ankiLinkId.trim());
  return [`anki_link_id:${value}`, `AnkiLinkId:${value}`];
}

async function getAnkiStudyStatus(item: PendingStudyWord) {
  if (!item.anki_link_id) return { existsInAnki: false, isInKnowingFilter: false };
  let noteIds: number[] = [];
  for (const query of ankiLinkQueries(item.anki_link_id)) {
    const response = await ankiOperations.findNotes({ query });
    if (!response.ok) throw new Error(response.error);
    noteIds = response.result ?? [];
    if (noteIds.length) break;
  }
  for (const noteId of noteIds) {
    const response = await ankiOperations.findCards({
      query: `nid:${noteId} deck:${quoteAnkiValue(FILTER_KNOWING_DECK)}`,
    });
    if (!response.ok) throw new Error(response.error);
    if ((response.result ?? []).length > 0) {
      return { existsInAnki: true, isInKnowingFilter: true };
    }
  }
  return { existsInAnki: noteIds.length > 0, isInKnowingFilter: false };
}

function resolvePendingStudyStatus(
  item: PendingStudyWord,
  existsInAnki: boolean,
): PendingStudyStatus {
  if (item.missing_from_database) return "incomplete";
  if (existsInAnki) return "in_anki_not_filter";
  return item.anki_ready ? "not_in_anki" : "incomplete";
}

const DETAILED_STATUS_GROUPS: Array<{
  status: PendingStudyStatus;
  title: string;
  description: string;
}> = [
  {
    status: "incomplete",
    title: "ناقص در دیتابیس",
    description: "هنوز برای ساخت Note در Anki آماده نیست.",
  },
  {
    status: "not_in_anki",
    title: "آماده، اما هنوز در Anki نیست",
    description: "اطلاعات لازم کامل است، اما Note متناظر هنوز ساخته نشده است.",
  },
  {
    status: "in_anki_not_filter",
    title: "در Anki است، اما هنوز در FilterKnowing نیست",
    description: "Note پیدا شد و اکنون باید وارد مرحلهٔ فیلتر شود.",
  },
];

export function PendingStudyWords({
  user = "behrang",
  showDetailedStatuses = false,
  onTransferToStudyQueue,
}: {
  user?: string;
  showDetailedStatuses?: boolean;
  onTransferToStudyQueue?: (ankiLinkId: string) => Promise<void>;
}) {
  const [items, setItems] = useState<ResolvedPendingStudyWord[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [transferringId, setTransferringId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);

  const loadAndReconcile = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/v1/study-lists/${encodeURIComponent(user)}`, {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        items?: PendingStudyWord[];
      } | null;
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || `Study list request failed (${response.status}).`);
      }
      const loadedItems = data.items ?? [];
      const completedIds: number[] = [];
      const resolvedItems: ResolvedPendingStudyWord[] = [];
      for (const item of loadedItems) {
        const ankiStatus = item.missing_from_database
          ? { existsInAnki: false, isInKnowingFilter: false }
          : await getAnkiStudyStatus(item);
        if (ankiStatus.isInKnowingFilter) {
          completedIds.push(item.id);
          continue;
        }
        resolvedItems.push({
          ...item,
          study_status: resolvePendingStudyStatus(item, ankiStatus.existsInAnki),
        });
      }

      if (completedIds.length) {
        const deleteResponse = await fetch(`/api/v1/study-lists/${encodeURIComponent(user)}`, {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ wordSenseIds: completedIds }),
        });
        const deleteData = (await deleteResponse.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
        } | null;
        if (!deleteResponse.ok || !deleteData?.ok) {
          throw new Error(deleteData?.error || `Study list update failed (${deleteResponse.status}).`);
        }
        setMessage(`${completedIds.length.toLocaleString("fa-IR")} مورد وارد FilterKnowing شده بود و از فهرست حذف شد.`);
      }
      setItems(resolvedItems);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
    } finally {
      setChecking(false);
    }
  }, [checking, user]);

  const transferToStudyQueue = useCallback(
    async (item: ResolvedPendingStudyWord) => {
      if (!onTransferToStudyQueue || checking || transferringId !== null) return;

      setTransferringId(item.id);
      setTransferError(null);
      try {
        await onTransferToStudyQueue(item.anki_link_id);
        await loadAndReconcile();
      } catch (caughtError) {
        setTransferError(
          caughtError instanceof Error ? caughtError.message : String(caughtError),
        );
      } finally {
        setTransferringId(null);
      }
    },
    [checking, loadAndReconcile, onTransferToStudyQueue, transferringId],
  );

  useEffect(() => {
    void loadAndReconcile();
    // Reconcile once whenever the user list changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (items === null && !error) {
    return (
      <div dir="rtl" className="rounded-xl border border-card bg-background px-4 py-3 text-right text-sm text-muted">
        در حال بررسی خودکار فهرست مطالعهٔ بهرنگ…
      </div>
    );
  }

  if (!items?.length && !error && !message) return null;

  return (
    <section
      dir="rtl"
      className={`rounded-xl border p-4 text-right ${
        items?.length
          ? "border-red-500/60 bg-red-500/10 shadow-[0_0_0_1px_rgba(239,68,68,0.08)]"
          : "border-emerald-500/30 bg-emerald-500/5"
      }`}
      aria-live="polite"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className={`text-sm font-bold ${items?.length ? "text-red-800 dark:text-red-300" : "text-emerald-800 dark:text-emerald-300"}`}>
            {items?.length
              ? showDetailedStatuses
                ? `${items.length.toLocaleString("fa-IR")} مفهوم در مسیر ورود به مطالعه است`
                : `${items.length.toLocaleString("fa-IR")} مفهوم باید وارد FilterKnowing شود`
              : "فهرست مطالعه بررسی شد"}
          </div>
          <div className="mt-1 text-xs text-muted">
            {showDetailedStatuses
              ? "مرحلهٔ هر مفهوم با بررسی کامل‌بودن اطلاعات و وضعیت آن در Anki مشخص می‌شود."
              : "تطبیق با Anki به‌صورت خودکار و بر اساس "}
            {!showDetailedStatuses ? <span dir="ltr" className="font-mono">anki_link_id</span> : null}
            {!showDetailedStatuses ? " انجام می‌شود." : null}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadAndReconcile()}
          disabled={checking}
          className="h-9 rounded-lg border border-card bg-background px-3 text-xs font-semibold text-foreground transition hover:bg-accent disabled:opacity-60"
        >
          {checking ? "در حال بررسی…" : "بررسی دوباره"}
        </button>
      </div>

      {items?.length && showDetailedStatuses ? (
        <div className="mt-3 grid gap-3">
          {DETAILED_STATUS_GROUPS.map((group) => {
            const groupItems = items.filter((item) => item.study_status === group.status);
            if (!groupItems.length) return null;
            return (
              <div key={group.status} className="rounded-lg border border-red-500/30 bg-background/80 p-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <div className="text-sm font-bold text-red-800 dark:text-red-300">{group.title}</div>
                  <div className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-700 dark:text-red-300">
                    {groupItems.length.toLocaleString("fa-IR")}
                  </div>
                </div>
                <div className="mt-1 text-xs text-muted">{group.description}</div>
                <div className="mt-2 grid gap-2">
                  {groupItems.map((item) => (
                    <PendingStudyWordRow
                      key={item.id}
                      item={item}
                      showReadinessIssues
                      onTransfer={
                        onTransferToStudyQueue
                          ? () => void transferToStudyQueue(item)
                          : undefined
                      }
                      transferDisabled={checking || transferringId !== null}
                      transferring={transferringId === item.id}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : items?.length ? (
        <div className="mt-3 grid gap-2">
          {items.map((item) => (
            <PendingStudyWordRow
              key={item.id}
              item={item}
              onTransfer={
                onTransferToStudyQueue
                  ? () => void transferToStudyQueue(item)
                  : undefined
              }
              transferDisabled={checking || transferringId !== null}
              transferring={transferringId === item.id}
            />
          ))}
        </div>
      ) : null}

      {message ? <div className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">{message}</div> : null}
      {error ? (
        <div className="mt-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
          بررسی خودکار کامل نشد: {error} هیچ IDی حذف نشد.
        </div>
      ) : null}
      {transferError ? (
        <div className="mt-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
          انتقال انجام نشد: {transferError}
        </div>
      ) : null}
    </section>
  );
}

function PendingStudyWordRow({
  item,
  showReadinessIssues = false,
  onTransfer,
  transferDisabled = false,
  transferring = false,
}: {
  item: ResolvedPendingStudyWord;
  showReadinessIssues?: boolean;
  onTransfer?: () => void;
  transferDisabled?: boolean;
  transferring?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-red-500/25 bg-background px-3 py-2 text-sm">
      <Link
        href={`/words/tables/words?q=${item.id}&searchField=id`}
        className="font-mono font-bold text-red-700 underline-offset-2 hover:underline dark:text-red-300"
      >
        ID {item.id}
      </Link>
      <span dir="ltr" className="font-semibold text-foreground">
        {item.base_form || "Database record missing"}
      </span>
      {item.meaning_fa ? <span className="text-foreground">{item.meaning_fa}</span> : null}
      {!showReadinessIssues ? (
        <span className="text-xs font-semibold text-red-700 dark:text-red-300">
          {item.missing_from_database ? "رکورد دیتابیس پیدا نشد" : "هنوز در FilterKnowing نیست"}
        </span>
      ) : null}
      {showReadinessIssues && item.study_status === "incomplete" ? (
        <span className="text-xs text-muted">
          {item.missing_from_database
            ? "رکورد دیتابیس پیدا نشد"
            : `${item.anki_readiness_issues.length.toLocaleString("fa-IR")} مورد ناقص${
                item.anki_readiness_issues.length
                  ? `: ${item.anki_readiness_issues.slice(0, 3).map((issue) => issue.field).join("، ")}${item.anki_readiness_issues.length > 3 ? "…" : ""}`
                  : ""
              }`}
        </span>
      ) : null}
      {onTransfer ? (
        <button
          type="button"
          onClick={onTransfer}
          disabled={transferDisabled || !item.anki_link_id}
          className="ms-auto rounded-lg border border-card bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-accent disabled:opacity-60"
        >
          {transferring ? "در حال انتقال…" : "انتقال ساختار درختی به صف"}
        </button>
      ) : null}
    </div>
  );
}
