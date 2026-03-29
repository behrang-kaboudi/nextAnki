"use client";

import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { createAnkiConnectClient } from "@/lib/AnkiConnect";

type SyncAllStatus = {
  jobId: string;
  running: boolean;
  done: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  stopRequested: boolean;
  stoppedEarly: boolean;
  total: number;
  processed: number;
  created?: number;
  updated: number;
  skippedSame: number;
  skippedNoLinkId: number;
  skippedNoWord: number;
  failed: number;
  mediaUploaded: number;
  mediaDeleted: number;
  currentNoteId: number | null;
};

type LogEntry = {
  ts: string;
  level: "info" | "error";
  message: string;
  data?: unknown;
};

type MissingAnkiNote = {
  noteId: number;
  modelName: string;
  anki_link_id: string;
  base_form: string;
  meaning_fa: string;
};

type MissingAnkiNotesResponse = {
  query?: string;
  totalNotes?: number;
  checkedNotes?: number;
  missing?: MissingAnkiNote[];
  error?: string;
};

function nowIso() {
  return new Date().toISOString();
}

function formatForLog(entry: LogEntry) {
  const prefix = `[${entry.ts}] ${entry.level.toUpperCase()}: ${entry.message}`;
  if (entry.data === undefined) return prefix;
  try {
    return `${prefix}\n${JSON.stringify(entry.data, null, 2)}`;
  } catch {
    return `${prefix}\n${String(entry.data)}`;
  }
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <span
      dir="ltr"
      className="rounded bg-black/5 px-1 py-0.5 font-mono text-[11px] dark:bg-white/10"
    >
      {children}
    </span>
  );
}

export default function SyncAnkiWordsClient() {
  const client = useMemo(
    () => createAnkiConnectClient({ timeoutMs: 15_000, retryDelayMs: 750 }),
    [],
  );

  const [isRunning, setIsRunning] = useState(false);
  const [pollingEnabled, setPollingEnabled] = useState(true);
  const [helpOpen, setHelpOpen] = useState<
    | null
    | "permission"
    | "json_hint"
    | "media_copy"
    | "full_sync"
    | "dedup"
    | "sentence_en"
    | "sentence_en_meaning_fa"
    | "meaning_fa"
    | "other_meanings_fa"
    | "concept_explained_fa"
    | "clear_log"
  >(null);
  const [permissionText, setPermissionText] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [preview, setPreview] = useState<unknown | null>(null);
  const [jsonHintStatus, setJsonHintStatus] = useState<SyncAllStatus | null>(null);
  const [mediaSyncStatus, setMediaSyncStatus] = useState<SyncAllStatus | null>(null);
  const [fullSyncStatus, setFullSyncStatus] = useState<SyncAllStatus | null>(null);
  const [dedupStatus, setDedupStatus] = useState<SyncAllStatus | null>(null);
  const [otherMeaningsFaStatus, setOtherMeaningsFaStatus] = useState<SyncAllStatus | null>(null);
  const [meaningFaStatus, setMeaningFaStatus] = useState<SyncAllStatus | null>(null);
  const [sentenceEnStatus, setSentenceEnStatus] = useState<SyncAllStatus | null>(null);
  const [sentenceEnMeaningFaStatus, setSentenceEnMeaningFaStatus] = useState<SyncAllStatus | null>(null);
  const [conceptExplainedFaStatus, setConceptExplainedFaStatus] = useState<SyncAllStatus | null>(null);
  const [missingDeleteModalOpen, setMissingDeleteModalOpen] = useState(false);
  const [missingDeleteLoading, setMissingDeleteLoading] = useState(false);
  const [missingDeleteDeleting, setMissingDeleteDeleting] = useState(false);
  const [missingDeleteError, setMissingDeleteError] = useState<string | null>(null);
  const [missingDeleteQuery, setMissingDeleteQuery] = useState<string | null>(null);
  const [missingDeleteTotalNotes, setMissingDeleteTotalNotes] = useState<number | null>(null);
  const [missingDeleteCheckedNotes, setMissingDeleteCheckedNotes] = useState<number | null>(null);
  const [missingDeleteItems, setMissingDeleteItems] = useState<MissingAnkiNote[]>([]);

  const helpContent = useMemo(() => {
    return {
      permission: {
        title: "Request permission",
        body: (
          <div className="space-y-3">
            <div className="text-sm">
              درخواست مجوز از AnkiConnect برای اینکه این صفحه بتواند به Anki API درخواست بزند.
            </div>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">پیش‌نیازها</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>
                  Anki باید باز باشد و افزونه‌ی <Code>AnkiConnect</Code> نصب و فعال باشد.
                </li>
                <li>مرورگر باید اجازه‌ی اتصال به AnkiConnect را داشته باشد (ممکن است Popup تایید نشان داده شود).</li>
              </ul>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">خروجی</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>اگر درخواست موفق باشد، مقدار permission در UI بالا به‌روزرسانی می‌شود.</li>
                <li>اگر شکست بخورد، خطا در Log ثبت می‌شود و هیچ job دیگری شروع نمی‌شود.</li>
              </ul>
            </section>
          </div>
        ),
      },
      json_hint: {
        title: "Sync json_hint + hints",
        body: (
          <div className="space-y-3">
            <div className="text-sm">
              یک job سمت سرور اجرا می‌شود که نوت‌های مدل <Code>META_LEX_VR9</Code> را از Anki می‌گیرد و فیلدهای hint را
              بر اساس دیتابیس دوباره تولید می‌کند.
            </div>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">نوت‌های هدف</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>
                  Query: <Code>note:&quot;META_LEX_VR9&quot;</Code> (از طریق AnkiConnect <Code>findNotes</Code>)
                </li>
                <li>
                  برای هر note، <Code>anki_link_id</Code> از فیلدهای alias خوانده می‌شود (مثل <Code>anki_link_id</Code> /{" "}
                  <Code>AnkiLinkId</Code> / <Code>ankiLinkId</Code>).
                </li>
              </ul>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">شرایط Update/Skip</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>
                  اگر note <Code>anki_link_id</Code> نداشته باشد → <Code>skippedNoLinkId</Code>
                </li>
                <li>
                  اگر در DB برای آن <Code>anki_link_id</Code> رکوردی نباشد → <Code>skippedNoWord</Code>
                </li>
                <li>
                  اگر مقدار فعلی Anki با مقدار تولیدی یکی باشد → <Code>skippedSame</Code> (هیچ update انجام نمی‌شود)
                </li>
                <li>
                  فقط همان فیلدهای مربوط به این job تغییر می‌کنند (نه همه‌ی فیلدها).
                </li>
              </ul>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">مدیا/صوت</div>
              <div className="mt-2 text-sm">
                این دکمه هیچ عملیات <Code>storeMediaFile</Code>/<Code>deleteMediaFile</Code> انجام نمی‌دهد و فقط متن فیلدها
                را در Anki به‌روزرسانی می‌کند. اگر خروجی شامل <Code>[sound:...]</Code> باشد، آپلود فایل‌ها باید با دکمه‌ی{" "}
                <Code>Copy all media</Code> انجام شود.
              </div>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">API</div>
              <div className="mt-2 text-sm">
                <Code>/api/tests/sync-anki-words/json-hint/sync-all/start</Code> •{" "}
                <Code>/status</Code> • <Code>/stop</Code>
              </div>
            </section>
          </div>
        ),
      },
      media_copy: {
        title: "Copy all media",
        body: (
          <div className="space-y-3">
            <div className="text-sm">
              یک job اجرا می‌شود که فایل‌های media (audio/image) را از پوشه‌های محلی پروژه می‌خواند و با AnkiConnect داخل
              Anki media ذخیره می‌کند.
            </div>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">شرایط Upload</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>فقط برای آیتم‌هایی اقدام می‌کند که فایل محلیِ متناظر وجود داشته باشد و سایزش صفر نباشد.</li>
                <li>اگر فایل از قبل در Anki media وجود داشته باشد، upload/copy برای همان filename انجام نمی‌شود (بدون overwrite).</li>
              </ul>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">API</div>
              <div className="mt-2 text-sm">
                <Code>/api/tests/sync-anki-words/media/sync-all/start</Code> •{" "}
                <Code>/status</Code> • <Code>/stop</Code>
              </div>
            </section>
          </div>
        ),
      },
      full_sync: {
        title: "Full sync DB → Anki",
        body: (
          <div className="space-y-3">
            <div className="text-sm">
              سینک کامل DB → Anki برای مدل <Code>META_LEX_VR9</Code>: برای هر note، مقدار تمام فیلدهای mapping شده تولید
              می‌شود و فقط در صورت تفاوت، روی Anki نوشته می‌شود.
            </div>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">نوت‌های هدف</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>
                  Query: <Code>note:&quot;META_LEX_VR9&quot;</Code>
                </li>
                <li>
                  کلید اتصال با DB: <Code>anki_link_id</Code>
                </li>
              </ul>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">شرایط Update/Skip</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>اگر رکورد DB وجود نداشته باشد → skip (skippedNoWord)</li>
                <li>اگر <Code>anki_link_id</Code> نداشته باشد → skip (skippedNoLinkId)</li>
                <li>اگر فیلد تولیدی با مقدار فعلی یکی باشد → skip (skippedSame)</li>
                <li>در غیر این صورت → updateNoteFields (updated/created)</li>
              </ul>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">صوت/مدیا</div>
              <div className="mt-2 text-sm">
                بعضی فیلدها ممکن است با توجه به فایل‌های محلی صوت، تگ <Code>[sound:filename.mp3]</Code> دریافت کنند؛ در این
                دکمه فایل‌ها را آپلود/حذف نمی‌کند و فقط متن را می‌نویسد. برای آپلود فایل‌ها از <Code>Copy all media</Code>{" "}
                استفاده کنید.
              </div>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">API</div>
              <div className="mt-2 text-sm">
                <Code>/api/tests/sync-anki-words/full/sync-all/start</Code> •{" "}
                <Code>/status</Code> • <Code>/stop</Code>
              </div>
            </section>
          </div>
        ),
      },
      dedup: {
        title: "Deduplicate (keep oldest)",
        body: (
          <div className="space-y-3">
            <div className="text-sm">
              job دِدوپ: نوت‌ها را بر اساس مقدار <Code>anki_link_id</Code> گروه‌بندی می‌کند و اگر برای یک id چند note وجود
              داشته باشد، فقط قدیمی‌ترین (کمترین <Code>noteId</Code>) را نگه می‌دارد و بقیه را حذف می‌کند.
            </div>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">شرایط حذف</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>اگر note فاقد <Code>anki_link_id</Code> باشد، معمولاً وارد گروه‌بندی نمی‌شود.</li>
                <li>اگر در یک گروه فقط ۱ note باشد، کاری انجام نمی‌شود.</li>
              </ul>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">هشدار</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>این عملیات destructive است (حذف note).</li>
                <li>قبل از اجرا بکاپ از Anki توصیه می‌شود.</li>
              </ul>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">API</div>
              <div className="mt-2 text-sm">
                <Code>/api/tests/sync-anki-words/anki-link-id/deduplicate/start</Code> •{" "}
                <Code>/status</Code> • <Code>/stop</Code>
              </div>
            </section>
          </div>
        ),
      },
      sentence_en: {
        title: "Sync sentence_en",
        body: (
          <div className="space-y-3">
            <div className="text-sm">
              سینک یک‌فیلد: مقدار <Code>sentence_en</Code> در Anki را از روی DB ست می‌کند (و در صورت وجود صوت محلی، sound tag
              اضافه می‌شود).
            </div>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">شرایط Update/Skip</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>note بدون <Code>anki_link_id</Code> → <Code>skippedNoLinkId</Code></li>
                <li>DB row برای آن id پیدا نشود → <Code>skippedNoWord</Code></li>
                <li>مقدار جدید دقیقاً برابر مقدار فعلی باشد → <Code>skippedSame</Code></li>
                <li>در غیر این صورت → <Code>updateNoteFields</Code> و <Code>updated += 1</Code></li>
              </ul>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">صوت + Media</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>
                  اگر فایل صوتی محلی برای <Code>sentence_en</Code> موجود باشد و size&gt;0 → به متن <Code>[sound:filename]</Code>{" "}
                  اضافه می‌شود.
                </li>
                <li>
                  این دکمه فایل صوتی را به Anki media آپلود/حذف نمی‌کند (فقط متن را آپدیت می‌کند).
                </li>
                <li>
                  برای همگام‌سازی فایل‌ها با Anki media از دکمه‌ی <Code>Copy all media</Code> استفاده کنید.
                </li>
              </ul>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">API</div>
              <div className="mt-2 text-sm">
                <Code>/api/tests/sync-anki-words/sentence-en/sync-all/start</Code> •{" "}
                <Code>/status</Code> • <Code>/stop</Code>
              </div>
            </section>
          </div>
        ),
      },
      sentence_en_meaning_fa: {
        title: "Sync sentence_en_meaning_fa",
        body: (
          <div className="space-y-3">
            <div className="text-sm">
              سینک یک‌فیلد برای <Code>sentence_en_meaning_fa</Code> (DB → Anki) با همان قوانین skip/update و مدیریت sound tag.
            </div>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">شرایط Update/Skip</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>بدون <Code>anki_link_id</Code> → skippedNoLinkId</li>
                <li>بدون DB row → skippedNoWord</li>
                <li>عدم تغییر مقدار → skippedSame</li>
                <li>در غیر این صورت → updateNoteFields</li>
              </ul>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">صوت + Media</div>
              <div className="mt-2 text-sm">
                اگر فایل صوتی محلی برای همین field وجود داشته باشد و size&gt;0 باشد، tag <Code>[sound:...]</Code> به متن
                اضافه می‌شود. این دکمه فایل را آپلود/حذف نمی‌کند؛ آپلود با <Code>Copy all media</Code> انجام می‌شود.
              </div>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">API</div>
              <div className="mt-2 text-sm">
                <Code>/api/tests/sync-anki-words/sentence-en-meaning-fa/sync-all/start</Code> •{" "}
                <Code>/status</Code> • <Code>/stop</Code>
              </div>
            </section>
          </div>
        ),
      },
      meaning_fa: {
        title: "Sync meaning_fa",
        body: (
          <div className="space-y-3">
            <div className="text-sm">
              سینک یک‌فیلد برای <Code>meaning_fa</Code> (DB → Anki). مقدار جدید از DB می‌آید و فقط در صورت تفاوت، روی Anki
              نوشته می‌شود.
            </div>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">الگوریتم (شرط‌ها)</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>
                  نوت‌های هدف: <Code>note:&quot;META_LEX_VR9&quot;</Code>
                </li>
                <li>
                  اگر <Code>anki_link_id</Code> خالی/ناموجود باشد → <Code>skippedNoLinkId</Code>
                </li>
                <li>
                  اگر در DB رکوردی با همان <Code>anki_link_id</Code> نباشد → <Code>skippedNoWord</Code>
                </li>
                <li>
                  مقدار جدید = <Code>DB.meaning_fa</Code> + (اختیاری) sound tag
                </li>
                <li>اگر مقدار جدید دقیقاً برابر مقدار فعلی Anki باشد → <Code>skippedSame</Code></li>
                <li>در غیر این صورت → <Code>updateNoteFields</Code> و <Code>updated += 1</Code></li>
              </ul>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">قانون sound tag</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>
                  سیستم آخرین فایل صوتی محلی برای این field را پیدا می‌کند (جدیدترین timestamp در{" "}
                  <Code>public/audio/words</Code>).
                </li>
                <li>اگر فایل پیدا نشود یا size=0 باشد → هیچ <Code>[sound:...]</Code> اضافه نمی‌شود.</li>
                <li>اگر tag همان فایل از قبل داخل متن DB باشد → دوباره اضافه نمی‌شود.</li>
              </ul>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">Media</div>
              <div className="mt-2 text-sm">
                این دکمه هیچ عملیات آپلود/حذف مدیا انجام نمی‌دهد. اگر متن شامل <Code>[sound:...]</Code> است، وجود/به‌روزرسانی
                فایل‌ها در Anki media به عهده‌ی <Code>Copy all media</Code> است.
              </div>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">API</div>
              <div className="mt-2 text-sm">
                <Code>/api/tests/sync-anki-words/meaning-fa/sync-all/start</Code> •{" "}
                <Code>/status</Code> • <Code>/stop</Code>
              </div>
            </section>
          </div>
        ),
      },
      other_meanings_fa: {
        title: "Sync other_meanings_fa",
        body: (
          <div className="space-y-3">
            <div className="text-sm">
              سینک یک‌فیلد برای <Code>other_meanings_fa</Code> (DB → Anki) با قوانین مشابه: فقط وقتی مقدار جدید با مقدار فعلی
              متفاوت باشد update می‌کند.
            </div>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">شرایط Update/Skip</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>بدون <Code>anki_link_id</Code> → skippedNoLinkId</li>
                <li>بدون DB row → skippedNoWord</li>
                <li>بدون تغییر → skippedSame</li>
              </ul>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">صوت + Media</div>
              <div className="mt-2 text-sm">
                اگر صوت محلی برای <Code>other_meanings_fa</Code> موجود و size&gt;0 باشد، <Code>[sound:...]</Code> اضافه و فایل
                آپلود/به‌روزرسانی فایل در Anki media توسط این دکمه انجام نمی‌شود و باید با <Code>Copy all media</Code> انجام شود.
              </div>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">API</div>
              <div className="mt-2 text-sm">
                <Code>/api/tests/sync-anki-words/other-meanings-fa/sync-all/start</Code> •{" "}
                <Code>/status</Code> • <Code>/stop</Code>
              </div>
            </section>
          </div>
        ),
      },
      concept_explained_fa: {
        title: "Sync concept_explained_fa",
        body: (
          <div className="space-y-3">
            <div className="text-sm">
              سینک یک‌فیلد برای <Code>concept_explained_fa</Code> (DB → Anki) با قوانین مشابه: فقط وقتی مقدار جدید با مقدار
              فعلی متفاوت باشد update می‌کند.
            </div>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">شرایط Update/Skip</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>بدون <Code>anki_link_id</Code> → skippedNoLinkId</li>
                <li>بدون DB row → skippedNoWord</li>
                <li>بدون تغییر → skippedSame</li>
              </ul>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">صوت + Media</div>
              <div className="mt-2 text-sm">
                اگر صوت محلی برای <Code>concept_explained_fa</Code> موجود و size&gt;0 باشد، <Code>[sound:...]</Code> اضافه
                می‌شود. این دکمه فایل را آپلود/حذف نمی‌کند و باید با <Code>Copy all media</Code> انجام شود.
              </div>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">API</div>
              <div className="mt-2 text-sm">
                <Code>/api/tests/sync-anki-words/concept-explained-fa/sync-all/start</Code> •{" "}
                <Code>/status</Code> • <Code>/stop</Code>
              </div>
            </section>
          </div>
        ),
      },
      clear_log: {
        title: "Clear log",
        body: (
          <div className="space-y-2">
            <div className="text-sm">
              فقط stateهای UI را ریست می‌کند (<Code>log</Code> و <Code>preview</Code>) و هیچ request به سرور/Anki/DB
              نمی‌فرستد.
            </div>
          </div>
        ),
      },
    } as const;
  }, []);

  const HelpButton = ({ id }: { id: NonNullable<typeof helpOpen> }) => (
    <button
      type="button"
      onClick={() => setHelpOpen(id)}
      className="h-10 w-10 rounded-xl border border-card bg-background text-sm font-semibold text-foreground transition hover:bg-black/5 dark:hover:bg-white/5"
      aria-label="Help"
      title="Help"
    >
      ?
    </button>
  );

  useEffect(() => {
    if (!helpOpen && !missingDeleteModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [helpOpen, missingDeleteModalOpen]);

  function append(entry: Omit<LogEntry, "ts">) {
    setLog((prev) => [...prev, { ts: nowIso(), ...entry }]);
  }

  async function requestPermission() {
    const res = await client.requestDetailed("requestPermission");
    if (!res.ok) {
      append({ level: "error", message: "requestPermission failed", data: res.error });
      return;
    }
    const permission = res.result?.permission ?? "unknown";
    setPermissionText(permission);
    append({ level: "info", message: `Permission: ${permission}` });
  }

  async function startSyncJsonHint() {
    if (isRunning || jsonHintStatus?.running) return;
    setPollingEnabled(true);
    setIsRunning(true);
    setPreview(null);

    try {
      append({ level: "info", message: "Starting sync json_hint + first_letter_*_hint (all notes)..." });
      const res = await fetch("/api/tests/sync-anki-words/json-hint/sync-all/start", { method: "POST" });
      const data = (await res.json()) as { status?: SyncAllStatus } | unknown;
      setPreview(data);
      if (data && typeof data === "object" && "status" in data) {
        const s = (data as { status?: SyncAllStatus }).status ?? null;
        setJsonHintStatus(s);
      }
      append({ level: res.ok ? "info" : "error", message: "Start result", data });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      append({ level: "error", message: "Unexpected error", data: message });
    } finally {
      setIsRunning(false);
    }
  }

  async function startSyncSentenceEn() {
    if (isRunning || sentenceEnStatus?.running) return;
    setPollingEnabled(true);
    setIsRunning(true);
    setPreview(null);

    try {
      append({ level: "info", message: "Starting sync sentence_en (all notes)..." });
      const res = await fetch("/api/tests/sync-anki-words/sentence-en/sync-all/start", { method: "POST" });
      const data = (await res.json()) as { status?: SyncAllStatus } | unknown;
      setPreview(data);
      if (data && typeof data === "object" && "status" in data) {
        const s = (data as { status?: SyncAllStatus }).status ?? null;
        setSentenceEnStatus(s);
      }
      append({ level: res.ok ? "info" : "error", message: "Start result", data });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      append({ level: "error", message: "Unexpected error", data: message });
    } finally {
      setIsRunning(false);
    }
  }

  async function startSyncSentenceEnMeaningFa() {
    if (isRunning || sentenceEnMeaningFaStatus?.running) return;
    setPollingEnabled(true);
    setIsRunning(true);
    setPreview(null);

    try {
      append({ level: "info", message: "Starting sync sentence_en_meaning_fa (all notes)..." });
      const res = await fetch("/api/tests/sync-anki-words/sentence-en-meaning-fa/sync-all/start", { method: "POST" });
      const data = (await res.json()) as { status?: SyncAllStatus } | unknown;
      setPreview(data);
      if (data && typeof data === "object" && "status" in data) {
        const s = (data as { status?: SyncAllStatus }).status ?? null;
        setSentenceEnMeaningFaStatus(s);
      }
      append({ level: res.ok ? "info" : "error", message: "Start result", data });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      append({ level: "error", message: "Unexpected error", data: message });
    } finally {
      setIsRunning(false);
    }
  }

  async function startSyncOtherMeaningsFa() {
    if (isRunning || otherMeaningsFaStatus?.running) return;
    setPollingEnabled(true);
    setIsRunning(true);
    setPreview(null);

    try {
      append({ level: "info", message: "Starting sync other_meanings_fa (all notes)..." });
      const res = await fetch("/api/tests/sync-anki-words/other-meanings-fa/sync-all/start", { method: "POST" });
      const data = (await res.json()) as { status?: SyncAllStatus } | unknown;
      setPreview(data);
      if (data && typeof data === "object" && "status" in data) {
        const s = (data as { status?: SyncAllStatus }).status ?? null;
        setOtherMeaningsFaStatus(s);
      }
      append({ level: res.ok ? "info" : "error", message: "Start result", data });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      append({ level: "error", message: "Unexpected error", data: message });
    } finally {
      setIsRunning(false);
    }
  }

  async function startSyncConceptExplainedFa() {
    if (isRunning || conceptExplainedFaStatus?.running) return;
    setPollingEnabled(true);
    setIsRunning(true);
    setPreview(null);

    try {
      append({ level: "info", message: "Starting sync concept_explained_fa (all notes)..." });
      const res = await fetch("/api/tests/sync-anki-words/concept-explained-fa/sync-all/start", { method: "POST" });
      const data = (await res.json()) as { status?: SyncAllStatus } | unknown;
      setPreview(data);
      if (data && typeof data === "object" && "status" in data) {
        const s = (data as { status?: SyncAllStatus }).status ?? null;
        setConceptExplainedFaStatus(s);
      }
      append({ level: res.ok ? "info" : "error", message: "Start result", data });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      append({ level: "error", message: "Unexpected error", data: message });
    } finally {
      setIsRunning(false);
    }
  }

  async function startSyncMeaningFa() {
    if (isRunning || meaningFaStatus?.running) return;
    setPollingEnabled(true);
    setIsRunning(true);
    setPreview(null);

    try {
      append({ level: "info", message: "Starting sync meaning_fa (all notes)..." });
      const res = await fetch("/api/tests/sync-anki-words/meaning-fa/sync-all/start", { method: "POST" });
      const data = (await res.json()) as { status?: SyncAllStatus } | unknown;
      setPreview(data);
      if (data && typeof data === "object" && "status" in data) {
        const s = (data as { status?: SyncAllStatus }).status ?? null;
        setMeaningFaStatus(s);
      }
      append({ level: res.ok ? "info" : "error", message: "Start result", data });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      append({ level: "error", message: "Unexpected error", data: message });
    } finally {
      setIsRunning(false);
    }
  }

  async function startSyncAllMedia() {
    if (isRunning || mediaSyncStatus?.running) return;
    setPollingEnabled(true);
    setIsRunning(true);
    setPreview(null);

    try {
      append({ level: "info", message: "Starting media copy (pictureWord + words)..." });
      const res = await fetch("/api/tests/sync-anki-words/media/sync-all/start", { method: "POST" });
      const data = (await res.json()) as { status?: SyncAllStatus } | unknown;
      setPreview(data);
      if (data && typeof data === "object" && "status" in data) {
        const s = (data as { status?: SyncAllStatus }).status ?? null;
        setMediaSyncStatus(s);
      }
      append({ level: res.ok ? "info" : "error", message: "Start result", data });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      append({ level: "error", message: "Unexpected error", data: message });
    } finally {
      setIsRunning(false);
    }
  }

  async function startFullSyncAll() {
    if (isRunning || fullSyncStatus?.running) return;
    setPollingEnabled(true);
    setIsRunning(true);
    setPreview(null);

    try {
      append({ level: "info", message: "Starting FULL sync (DB -> Anki)..." });
      const res = await fetch("/api/tests/sync-anki-words/full/sync-all/start", { method: "POST" });
      const data = (await res.json()) as { status?: SyncAllStatus } | unknown;
      setPreview(data);
      if (data && typeof data === "object" && "status" in data) {
        const s = (data as { status?: SyncAllStatus }).status ?? null;
        setFullSyncStatus(s);
      }
      append({ level: res.ok ? "info" : "error", message: "Start result", data });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      append({ level: "error", message: "Unexpected error", data: message });
    } finally {
      setIsRunning(false);
    }
  }

  async function deduplicateAnkiLinkIdKeepOldest() {
    if (isRunning || dedupStatus?.running) return;
    setPollingEnabled(true);
    setIsRunning(true);
    setPreview(null);

    try {
      append({ level: "info", message: "Deduplicating notes by anki_link_id (keep oldest noteId)..." });
      const res = await fetch("/api/tests/sync-anki-words/anki-link-id/deduplicate/start", { method: "POST" });
      const data = (await res.json()) as { status?: SyncAllStatus } | unknown;
      setPreview(data);
      if (data && typeof data === "object" && "status" in data) {
        const s = (data as { status?: SyncAllStatus }).status ?? null;
        setDedupStatus(s);
      }
      append({ level: res.ok ? "info" : "error", message: "Start result", data });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      append({ level: "error", message: "Unexpected error", data: message });
    } finally {
      setIsRunning(false);
    }
  }

  async function loadMissingAnkiNotes() {
    setMissingDeleteLoading(true);
    setMissingDeleteDeleting(false);
    setMissingDeleteError(null);

    try {
      const res = await fetch("/api/word/anki-missing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limit: 5000 }),
      });
      const data = (await res.json().catch(() => ({}))) as MissingAnkiNotesResponse;
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);

      const missing = Array.isArray(data.missing) ? data.missing : [];
      setMissingDeleteQuery(data.query ?? null);
      setMissingDeleteTotalNotes(typeof data.totalNotes === "number" ? data.totalNotes : null);
      setMissingDeleteCheckedNotes(typeof data.checkedNotes === "number" ? data.checkedNotes : null);
      setMissingDeleteItems(missing);
      setPreview(data);
      append({
        level: "info",
        message: `Loaded ${missing.length} Anki note(s) missing in DB.`,
        data: {
          query: data.query ?? null,
          totalNotes: data.totalNotes ?? null,
          checkedNotes: data.checkedNotes ?? null,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setMissingDeleteError(message);
      append({ level: "error", message: "Failed to load Anki notes missing in DB", data: message });
    } finally {
      setMissingDeleteLoading(false);
    }
  }

  async function openMissingDeleteModal() {
    if (missingDeleteLoading || missingDeleteDeleting) return;
    setMissingDeleteModalOpen(true);
    setMissingDeleteItems([]);
    setMissingDeleteQuery(null);
    setMissingDeleteTotalNotes(null);
    setMissingDeleteCheckedNotes(null);
    await loadMissingAnkiNotes();
  }

  async function deleteMissingAnkiNotes() {
    if (!missingDeleteItems.length || missingDeleteDeleting) return;
    const ok = window.confirm(
      `Delete ${missingDeleteItems.length} Anki note(s) that do not exist in the local DB? This cannot be undone.`,
    );
    if (!ok) return;

    setMissingDeleteDeleting(true);
    setMissingDeleteError(null);
    try {
      const res = await fetch("/api/word/anki-missing/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ noteIds: missingDeleteItems.map((item) => item.noteId) }),
      });
      const data = (await res.json().catch(() => ({}))) as { deleted?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);

      append({
        level: "info",
        message: `Deleted ${data.deleted ?? 0} Anki note(s) missing in DB.`,
        data,
      });
      await loadMissingAnkiNotes();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setMissingDeleteError(message);
      append({ level: "error", message: "Failed to delete Anki notes missing in DB", data: message });
    } finally {
      setMissingDeleteDeleting(false);
    }
  }

  useEffect(() => {
    if (!pollingEnabled) return;
    let timer: number | null = null;
    let stopped = false;

    async function tick() {
      try {
        const [
          jsonHintRes,
          mediaRes,
          fullRes,
          dedupRes,
          otherRes,
          conceptRes,
          meaningRes,
          sentenceEnRes,
          sentenceMeaningRes,
        ] = await Promise.all([
          fetch("/api/tests/sync-anki-words/json-hint/sync-all/status", { cache: "no-store" }),
          fetch("/api/tests/sync-anki-words/media/sync-all/status", { cache: "no-store" }),
          fetch("/api/tests/sync-anki-words/full/sync-all/status", { cache: "no-store" }),
          fetch("/api/tests/sync-anki-words/anki-link-id/deduplicate/status", { cache: "no-store" }),
          fetch("/api/tests/sync-anki-words/other-meanings-fa/sync-all/status", { cache: "no-store" }),
          fetch("/api/tests/sync-anki-words/concept-explained-fa/sync-all/status", { cache: "no-store" }),
          fetch("/api/tests/sync-anki-words/meaning-fa/sync-all/status", { cache: "no-store" }),
          fetch("/api/tests/sync-anki-words/sentence-en/sync-all/status", { cache: "no-store" }),
          fetch("/api/tests/sync-anki-words/sentence-en-meaning-fa/sync-all/status", { cache: "no-store" }),
        ]);

        const jsonHintJson = (await jsonHintRes.json()) as { ok?: boolean; status?: SyncAllStatus };
        const mediaJson = (await mediaRes.json()) as { ok?: boolean; status?: SyncAllStatus };
        const fullJson = (await fullRes.json()) as { ok?: boolean; status?: SyncAllStatus };
        const dedupJson = (await dedupRes.json()) as { ok?: boolean; status?: SyncAllStatus };
        const otherJson = (await otherRes.json()) as { ok?: boolean; status?: SyncAllStatus };
        const conceptJson = (await conceptRes.json()) as { ok?: boolean; status?: SyncAllStatus };
        const meaningJson = (await meaningRes.json()) as { ok?: boolean; status?: SyncAllStatus };
        const sentenceEnJson = (await sentenceEnRes.json()) as { ok?: boolean; status?: SyncAllStatus };
        const sentenceMeaningJson = (await sentenceMeaningRes.json()) as { ok?: boolean; status?: SyncAllStatus };

        const jsonHint = jsonHintJson?.status ?? null;
        const media = mediaJson?.status ?? null;
        const full = fullJson?.status ?? null;
        const dedup = dedupJson?.status ?? null;
        const other = otherJson?.status ?? null;
        const concept = conceptJson?.status ?? null;
        const meaning = meaningJson?.status ?? null;
        const sentenceEn = sentenceEnJson?.status ?? null;
        const sentenceMeaning = sentenceMeaningJson?.status ?? null;
        setJsonHintStatus(jsonHint);
        setMediaSyncStatus(media);
        setFullSyncStatus(full);
        setDedupStatus(dedup);
        setOtherMeaningsFaStatus(other);
        setConceptExplainedFaStatus(concept);
        setMeaningFaStatus(meaning);
        setSentenceEnStatus(sentenceEn);
        setSentenceEnMeaningFaStatus(sentenceMeaning);

        const jsonHintDone = Boolean(jsonHint?.done);
        const mediaDone = Boolean(media?.done);
        const fullDone = Boolean(full?.done);
        const dedupDone = Boolean(dedup?.done);
        const otherDone = Boolean(other?.done);
        const conceptDone = Boolean(concept?.done);
        const meaningDone = Boolean(meaning?.done);
        const sentenceEnDone = Boolean(sentenceEn?.done);
        const sentenceMeaningDone = Boolean(sentenceMeaning?.done);
        const anyRunning = Boolean(
          jsonHint?.running ||
            media?.running ||
            full?.running ||
            dedup?.running ||
            other?.running ||
            concept?.running ||
            meaning?.running ||
            sentenceEn?.running ||
            sentenceMeaning?.running,
        );

        if (!anyRunning && jsonHintDone && mediaDone && fullDone && dedupDone && otherDone && conceptDone && meaningDone && sentenceEnDone && sentenceMeaningDone) {
          if (timer != null) window.clearInterval(timer);
          timer = null;
          if (!stopped) setPollingEnabled(false);
        }
      } catch {
        // ignore transient errors while polling
      }
    }

    void tick();
    timer = window.setInterval(() => {
      if (stopped) return;
      void tick();
    }, 1000);

    return () => {
      stopped = true;
      if (timer != null) window.clearInterval(timer);
    };
  }, [pollingEnabled]);

  const sentenceEnSkippedTotal =
    (sentenceEnStatus?.skippedSame ?? 0) +
    (sentenceEnStatus?.skippedNoLinkId ?? 0) +
    (sentenceEnStatus?.skippedNoWord ?? 0);

  const jsonHintSkippedTotal =
    (jsonHintStatus?.skippedSame ?? 0) +
    (jsonHintStatus?.skippedNoLinkId ?? 0) +
    (jsonHintStatus?.skippedNoWord ?? 0);

  const mediaSkippedTotal =
    (mediaSyncStatus?.skippedSame ?? 0) +
    (mediaSyncStatus?.skippedNoLinkId ?? 0) +
    (mediaSyncStatus?.skippedNoWord ?? 0);

  const fullSkippedTotal =
    (fullSyncStatus?.skippedSame ?? 0) +
    (fullSyncStatus?.skippedNoLinkId ?? 0) +
    (fullSyncStatus?.skippedNoWord ?? 0);

  const dedupSkippedTotal =
    (dedupStatus?.skippedSame ?? 0) +
    (dedupStatus?.skippedNoLinkId ?? 0) +
    (dedupStatus?.skippedNoWord ?? 0);

  const conceptSkippedTotal =
    (conceptExplainedFaStatus?.skippedSame ?? 0) +
    (conceptExplainedFaStatus?.skippedNoLinkId ?? 0) +
    (conceptExplainedFaStatus?.skippedNoWord ?? 0);

  const otherSkippedTotal =
    (otherMeaningsFaStatus?.skippedSame ?? 0) +
    (otherMeaningsFaStatus?.skippedNoLinkId ?? 0) +
    (otherMeaningsFaStatus?.skippedNoWord ?? 0);

  const meaningSkippedTotal =
    (meaningFaStatus?.skippedSame ?? 0) +
    (meaningFaStatus?.skippedNoLinkId ?? 0) +
    (meaningFaStatus?.skippedNoWord ?? 0);

  const sentenceSkippedTotal =
    (sentenceEnMeaningFaStatus?.skippedSame ?? 0) +
    (sentenceEnMeaningFaStatus?.skippedNoLinkId ?? 0) +
    (sentenceEnMeaningFaStatus?.skippedNoWord ?? 0);

  return (
    <main className="mx-auto w-full max-w-6xl select-text p-4">
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Sync Anki/Words"
          subtitle="Internal tool for syncing Anki note fields from the DB."
        />

        <div className="grid gap-3 rounded-2xl border border-card bg-background p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-muted">
              {permissionText ? (
                <span>
                  Permission: <span className="font-semibold">{permissionText}</span>
                </span>
              ) : (
                <span>Permission: unknown</span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void requestPermission()}
                  className="h-10 rounded-xl border border-card bg-background px-3 text-sm font-semibold text-foreground transition hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Request permission
                </button>
                <HelpButton id="permission" />
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void startSyncJsonHint()}
                  disabled={isRunning || Boolean(jsonHintStatus?.running)}
                  className="h-10 rounded-xl bg-foreground px-3 text-sm font-semibold text-background transition disabled:opacity-50"
                >
                  Sync json_hint + hints
                </button>
                <HelpButton id="json_hint" />
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void startSyncAllMedia()}
                  disabled={isRunning || Boolean(mediaSyncStatus?.running)}
                  className="h-10 rounded-xl bg-foreground px-3 text-sm font-semibold text-background transition disabled:opacity-50"
                >
                  Copy all media
                </button>
                <HelpButton id="media_copy" />
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void startFullSyncAll()}
                  disabled={isRunning || Boolean(fullSyncStatus?.running)}
                  className="h-10 rounded-xl bg-foreground px-3 text-sm font-semibold text-background transition disabled:opacity-50"
                >
                  Full sync DB → Anki
                </button>
                <HelpButton id="full_sync" />
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void deduplicateAnkiLinkIdKeepOldest()}
                  disabled={isRunning || Boolean(dedupStatus?.running)}
                  className="h-10 rounded-xl border border-card bg-background px-3 text-sm font-semibold text-foreground transition hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
                >
                  Deduplicate (keep oldest)
                </button>
                <HelpButton id="dedup" />
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void openMissingDeleteModal()}
                  disabled={missingDeleteLoading || missingDeleteDeleting}
                  className="h-10 rounded-xl border border-red-500/30 bg-red-600/10 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-600/15 disabled:opacity-50 dark:text-red-300"
                >
                  Delete Anki notes missing in DB
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void startSyncSentenceEn()}
                  disabled={isRunning || Boolean(sentenceEnStatus?.running)}
                  className="h-10 rounded-xl bg-foreground px-3 text-sm font-semibold text-background transition disabled:opacity-50"
                >
                  Sync sentence_en
                </button>
                <HelpButton id="sentence_en" />
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void startSyncSentenceEnMeaningFa()}
                  disabled={isRunning || Boolean(sentenceEnMeaningFaStatus?.running)}
                  className="h-10 rounded-xl bg-foreground px-3 text-sm font-semibold text-background transition disabled:opacity-50"
                >
                  Sync sentence_en_meaning_fa
                </button>
                <HelpButton id="sentence_en_meaning_fa" />
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void startSyncMeaningFa()}
                  disabled={isRunning || Boolean(meaningFaStatus?.running)}
                  className="h-10 rounded-xl bg-foreground px-3 text-sm font-semibold text-background transition disabled:opacity-50"
                >
                  Sync meaning_fa
                </button>
                <HelpButton id="meaning_fa" />
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void startSyncOtherMeaningsFa()}
                  disabled={isRunning || Boolean(otherMeaningsFaStatus?.running)}
                  className="h-10 rounded-xl bg-foreground px-3 text-sm font-semibold text-background transition disabled:opacity-50"
                >
                  Sync other_meanings_fa
                </button>
                <HelpButton id="other_meanings_fa" />
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void startSyncConceptExplainedFa()}
                  disabled={isRunning || Boolean(conceptExplainedFaStatus?.running)}
                  className="h-10 rounded-xl bg-foreground px-3 text-sm font-semibold text-background transition disabled:opacity-50"
                >
                  Sync concept_explained_fa
                </button>
                <HelpButton id="concept_explained_fa" />
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setLog([]);
                    setPreview(null);
                  }}
                  className="h-10 rounded-xl border border-card bg-background px-3 text-sm font-semibold text-foreground transition hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Clear log
                </button>
                <HelpButton id="clear_log" />
              </div>
            </div>
          </div>

          {helpOpen ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              role="dialog"
              aria-modal="true"
            >
              <div
                dir="rtl"
                lang="fa"
                className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded border bg-background p-4 text-right shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold">{helpContent[helpOpen].title}</div>
                    <div className="mt-1 text-xs opacity-80">
                      صفحه: <Code>/tests/sync-anki-words</Code>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHelpOpen(null)}
                    className="rounded border px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    Close
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-auto pt-3 text-sm leading-6">
                  <div className="space-y-3">{helpContent[helpOpen].body}</div>
                </div>
              </div>
            </div>
          ) : null}

          {missingDeleteModalOpen ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              role="dialog"
              aria-modal="true"
            >
              <div
                dir="rtl"
                lang="fa"
                className="flex max-h-[85vh] w-full max-w-5xl flex-col rounded border bg-background p-4 text-right shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-base font-semibold">حذف نوت‌های Anki که در دیتابیس نیستند</div>
                    <div className="text-xs opacity-80">
                      پیدا شده: <span className="font-semibold">{missingDeleteItems.length}</span>
                      {" "}• بررسی‌شده: <span className="font-semibold">{missingDeleteCheckedNotes ?? "—"}</span>
                      {" "}• کل نوت‌های query: <span className="font-semibold">{missingDeleteTotalNotes ?? "—"}</span>
                    </div>
                    {missingDeleteQuery ? (
                      <div className="text-xs opacity-80">
                        Query: <Code>{missingDeleteQuery}</Code>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void loadMissingAnkiNotes()}
                      disabled={missingDeleteLoading || missingDeleteDeleting}
                      className="rounded border px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
                    >
                      {missingDeleteLoading ? "در حال بارگذاری..." : "بازخوانی"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMissingDeleteModalOpen(false)}
                      disabled={missingDeleteDeleting}
                      className="rounded border px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
                    >
                      بستن
                    </button>
                  </div>
                </div>

                {missingDeleteError ? (
                  <div className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
                    {missingDeleteError}
                  </div>
                ) : null}

                <div className="mt-3 min-h-0 flex-1 overflow-auto rounded border">
                  {missingDeleteLoading ? (
                    <div className="p-4 text-sm text-muted">در حال دریافت لیست...</div>
                  ) : missingDeleteItems.length ? (
                    <table className="w-full text-right text-xs">
                      <thead className="sticky top-0 bg-background">
                        <tr className="border-b border-card">
                          <th className="whitespace-nowrap px-3 py-2 font-semibold text-neutral-700">noteId</th>
                          <th className="whitespace-nowrap px-3 py-2 font-semibold text-neutral-700">anki_link_id</th>
                          <th className="whitespace-nowrap px-3 py-2 font-semibold text-neutral-700">لغت</th>
                          <th className="px-3 py-2 font-semibold text-neutral-700">معنی</th>
                        </tr>
                      </thead>
                      <tbody>
                        {missingDeleteItems.map((item) => (
                          <tr key={`${item.noteId}-${item.anki_link_id}`} className="border-b border-card align-top">
                            <td className="whitespace-nowrap px-3 py-2 font-mono text-neutral-700">{item.noteId}</td>
                            <td className="whitespace-nowrap px-3 py-2 font-mono text-neutral-800">{item.anki_link_id}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-neutral-900">{item.base_form || "—"}</td>
                            <td className="min-w-[18rem] px-3 py-2 text-neutral-900">{item.meaning_fa || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-4 text-sm text-muted">هیچ نوتی برای حذف پیدا نشد.</div>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                  <div className="text-xs text-muted">
                    این عملیات نوت‌های پیدا شده را از Anki پاک می‌کند و قابل بازگشت نیست.
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteMissingAnkiNotes()}
                    disabled={missingDeleteLoading || missingDeleteDeleting || !missingDeleteItems.length}
                    className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                  >
                    {missingDeleteDeleting
                      ? "در حال حذف..."
                      : `حذف همه از Anki (${missingDeleteItems.length})`}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-1 text-xs text-muted">
            <div>
              {jsonHintStatus ? (
                <span>
                  json_hint + hints: Processed{" "}
                  <span className="font-semibold">{jsonHintStatus.processed}/{jsonHintStatus.total}</span> • Updated{" "}
                  <span className="font-semibold">{jsonHintStatus.updated}</span> • Skipped{" "}
                  <span className="font-semibold">{jsonHintSkippedTotal}</span> • Failed{" "}
                  <span className="font-semibold">{jsonHintStatus.failed}</span>
                </span>
              ) : (
                <span>json_hint + hints: Processed 0/0 • Updated 0 • Skipped 0 • Failed 0</span>
              )}
            </div>
            <div>
              {mediaSyncStatus ? (
                <span>
                  media copy: Processed{" "}
                  <span className="font-semibold">{mediaSyncStatus.processed}/{mediaSyncStatus.total}</span> • Uploaded{" "}
                  <span className="font-semibold">{mediaSyncStatus.mediaUploaded}</span> • Skipped{" "}
                  <span className="font-semibold">{mediaSkippedTotal}</span> • Failed{" "}
                  <span className="font-semibold">{mediaSyncStatus.failed}</span>
                </span>
              ) : (
                <span>media copy: Processed 0/0 • Uploaded 0 • Skipped 0 • Failed 0</span>
              )}
            </div>
            <div>
              {fullSyncStatus ? (
                <span>
                  full sync: Processed{" "}
                  <span className="font-semibold">{fullSyncStatus.processed}/{fullSyncStatus.total}</span> • Created{" "}
                  <span className="font-semibold">{fullSyncStatus.created ?? 0}</span> • Updated{" "}
                  <span className="font-semibold">{fullSyncStatus.updated}</span> • Skipped{" "}
                  <span className="font-semibold">{fullSkippedTotal}</span> • Failed{" "}
                  <span className="font-semibold">{fullSyncStatus.failed}</span>
                </span>
              ) : (
                <span>full sync: Processed 0/0 • Created 0 • Updated 0 • Skipped 0 • Failed 0</span>
              )}
            </div>
            <div>
              {dedupStatus ? (
                <span>
                  dedup: Processed{" "}
                  <span className="font-semibold">{dedupStatus.processed}/{dedupStatus.total}</span> • Deleted{" "}
                  <span className="font-semibold">{dedupStatus.updated}</span> • Kept{" "}
                  <span className="font-semibold">{dedupSkippedTotal}</span> • Failed{" "}
                  <span className="font-semibold">{dedupStatus.failed}</span>
                </span>
              ) : (
                <span>dedup: Processed 0/0 • Deleted 0 • Kept 0 • Failed 0</span>
              )}
            </div>
            <div>
              {sentenceEnStatus ? (
                <span>
                  sentence_en: Processed{" "}
                  <span className="font-semibold">{sentenceEnStatus.processed}/{sentenceEnStatus.total}</span> • Updated{" "}
                  <span className="font-semibold">{sentenceEnStatus.updated}</span> • Skipped{" "}
                  <span className="font-semibold">{sentenceEnSkippedTotal}</span> • Failed{" "}
                  <span className="font-semibold">{sentenceEnStatus.failed}</span>
                </span>
              ) : (
                <span>sentence_en: Processed 0/0 • Updated 0 • Skipped 0 • Failed 0</span>
              )}
            </div>
            <div>
              {sentenceEnMeaningFaStatus ? (
                <span>
                  sentence_en_meaning_fa: Processed{" "}
                  <span className="font-semibold">
                    {sentenceEnMeaningFaStatus.processed}/{sentenceEnMeaningFaStatus.total}
                  </span>{" "}
                  • Updated <span className="font-semibold">{sentenceEnMeaningFaStatus.updated}</span> • Skipped{" "}
                  <span className="font-semibold">{sentenceSkippedTotal}</span> • Failed{" "}
                  <span className="font-semibold">{sentenceEnMeaningFaStatus.failed}</span>
                </span>
              ) : (
                <span>sentence_en_meaning_fa: Processed 0/0 • Updated 0 • Skipped 0 • Failed 0</span>
              )}
            </div>
            <div>
              {meaningFaStatus ? (
                <span>
                  meaning_fa: Processed{" "}
                  <span className="font-semibold">
                    {meaningFaStatus.processed}/{meaningFaStatus.total}
                  </span>{" "}
                  • Updated <span className="font-semibold">{meaningFaStatus.updated}</span> • Skipped{" "}
                  <span className="font-semibold">{meaningSkippedTotal}</span> • Failed{" "}
                  <span className="font-semibold">{meaningFaStatus.failed}</span>
                </span>
              ) : (
                <span>meaning_fa: Processed 0/0 • Updated 0 • Skipped 0 • Failed 0</span>
              )}
            </div>
            <div>
              {conceptExplainedFaStatus ? (
                <span>
                  concept_explained_fa: Processed{" "}
                  <span className="font-semibold">
                    {conceptExplainedFaStatus.processed}/{conceptExplainedFaStatus.total}
                  </span>{" "}
                  • Updated <span className="font-semibold">{conceptExplainedFaStatus.updated}</span> • Skipped{" "}
                  <span className="font-semibold">{conceptSkippedTotal}</span> • Failed{" "}
                  <span className="font-semibold">{conceptExplainedFaStatus.failed}</span>
                </span>
              ) : (
                <span>concept_explained_fa: Processed 0/0 • Updated 0 • Skipped 0 • Failed 0</span>
              )}
            </div>
            <div>
              {otherMeaningsFaStatus ? (
                <span>
                  other_meanings_fa: Processed{" "}
                  <span className="font-semibold">
                    {otherMeaningsFaStatus.processed}/{otherMeaningsFaStatus.total}
                  </span>{" "}
                  • Updated <span className="font-semibold">{otherMeaningsFaStatus.updated}</span> • Skipped{" "}
                  <span className="font-semibold">{otherSkippedTotal}</span> • Failed{" "}
                  <span className="font-semibold">{otherMeaningsFaStatus.failed}</span>
                </span>
              ) : (
                <span>other_meanings_fa: Processed 0/0 • Updated 0 • Skipped 0 • Failed 0</span>
              )}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="grid gap-2">
              <div className="text-xs font-semibold text-muted">Log</div>
              <pre className="min-h-[16rem] whitespace-pre-wrap break-words rounded-xl border border-card bg-background p-3 font-mono text-xs text-foreground">
                {log.length ? log.map(formatForLog).join("\n\n") : "No logs yet."}
              </pre>
            </div>

            <div className="grid gap-2">
              <div className="text-xs font-semibold text-muted">Preview</div>
              <pre className="min-h-[16rem] whitespace-pre-wrap break-words rounded-xl border border-card bg-background p-3 font-mono text-xs text-foreground">
                {preview ? JSON.stringify(preview, null, 2) : "No preview yet."}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
