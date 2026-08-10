"use client";

import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { createAnkiOperations } from "@/lib/anki";
import { JOB_PROGRESS_TOPICS } from "@/lib/progress/topics";
import { useJobProgressStatuses } from "@/lib/progress/useJobProgress";

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
  failureSamples?: unknown[];
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
    <span dir="ltr" className="rounded bg-black/5 px-1 py-0.5 font-mono text-[11px] dark:bg-white/10">
      {children}
    </span>
  );
}

export default function SyncAnkiWordsClient() {
  const client = useMemo(() => createAnkiOperations({ timeoutMs: 15_000, retryDelayMs: 750 }), []);

  const [isRunning, setIsRunning] = useState(false);
  const progress = useJobProgressStatuses();
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
        title: "Sync json_hint",
        body: (
          <div className="space-y-3">
            <div className="text-sm">
              یک job سمت سرور اجرا می‌شود که نوت‌های مدل <Code>META_LEX_VR9</Code> را از Anki می‌گیرد و فقط فیلد
              <Code> json_hint</Code> را بر اساس دیتابیس دوباره تولید می‌کند. فیلد قدیمی{" "}
              <Code>first_letter_en_hint</Code>
              عمداً در Anki حفظ می‌شود و این job آن را تغییر نمی‌دهد.
            </div>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">نوت‌های هدف</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>
                  Query: <Code>note:&quot;META_LEX_VR9&quot;</Code> (از طریق AnkiConnect <Code>findNotes</Code>)
                </li>
                <li>
                  برای هر note، <Code>anki_link_id</Code> از فیلدهای alias خوانده می‌شود (مثل <Code>anki_link_id</Code>{" "}
                  / <Code>AnkiLinkId</Code> / <Code>ankiLinkId</Code>).
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
                <li>فقط همان فیلدهای مربوط به این job تغییر می‌کنند (نه همه‌ی فیلدها).</li>
              </ul>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">API</div>
              <div className="mt-2 text-sm">
                <Code>/api/tests/sync-anki-words/json-hint/sync-all/start</Code> • <Code>/status</Code> •{" "}
                <Code>/stop</Code>
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
              یک job اجرا می‌شود که تمام فایل‌های معتبر زیر <Code>public/audio</Code> را به‌صورت بازگشتی می‌خواند و داخل
              Anki media ذخیره می‌کند.
            </div>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">شرایط Upload</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>فقط برای آیتم‌هایی اقدام می‌کند که فایل محلیِ متناظر وجود داشته باشد و سایزش صفر نباشد.</li>
                <li>
                  اگر فایل از قبل در Anki media وجود داشته باشد، upload/copy برای همان filename انجام نمی‌شود (بدون
                  overwrite).
                </li>
                <li>
                  <Code>Copy changed media</Code> فقط فایل‌های دارای محتوای متفاوت را overwrite می‌کند.
                </li>
                <li>کپی‌ها asynchronous هستند؛ Progress و Stop هنگام انتقال انبوه پاسخ‌گو باقی می‌مانند.</li>
              </ul>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">API</div>
              <div className="mt-2 text-sm">
                <Code>/api/tests/sync-anki-words/media/sync-all/start</Code> • <Code>/status</Code> • <Code>/stop</Code>
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
                <li>
                  اگر <Code>anki_link_id</Code> نداشته باشد → skip (skippedNoLinkId)
                </li>
                <li>اگر فیلد تولیدی با مقدار فعلی یکی باشد → skip (skippedSame)</li>
                <li>تمام فیلدهای مدیریت‌شده در حافظه مقایسه می‌شوند و فقط فیلدهای متفاوت نوشته می‌شوند.</li>
                <li>
                  Updateها به‌صورت batch با AnkiConnect <Code>multi</Code> ارسال می‌شوند.
                </li>
              </ul>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">صوت/مدیا</div>
              <div className="mt-2 text-sm">
                بعضی فیلدها ممکن است با توجه به فایل‌های محلی صوت، تگ <Code>[sound:filename.mp3]</Code> دریافت کنند؛ در
                این دکمه فایل‌ها را آپلود/حذف نمی‌کند و فقط متن را می‌نویسد. برای آپلود فایل‌ها از{" "}
                <Code>Copy all media</Code> استفاده کنید.
              </div>
            </section>

            <section className="rounded border p-3" dir="rtl">
              <div className="text-xs font-semibold">معنی‌های انگلیسی مرتبط</div>
              <div className="mt-2 text-sm">
                فیلد <Code>other_meanings_en</Code> از واژه‌های انگلیسی رکوردهای اشاره‌شده در <Code>synonymIds</Code> و
                با جداکنندهٔ خط تیره ساخته می‌شود. فیلد <Code>other_meanings_en_audio</Code> نیز تمام صوت‌های موجود همان
                EnglishWordها را به ترتیب آرایه به‌صورت چند تگ <Code>[sound:...]</Code> می‌نویسد.
              </div>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">API</div>
              <div className="mt-2 text-sm">
                <Code>/api/tests/sync-anki-words/full/sync-all/start</Code> • <Code>/status</Code> • <Code>/stop</Code>
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
              job دِدوپ: نوت‌ها را بر اساس مقدار <Code>anki_link_id</Code> گروه‌بندی می‌کند و اگر برای یک id چند note
              وجود داشته باشد، فقط قدیمی‌ترین (کمترین <Code>noteId</Code>) را نگه می‌دارد و بقیه را حذف می‌کند.
            </div>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">شرایط حذف</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>
                  اگر note فاقد <Code>anki_link_id</Code> باشد، معمولاً وارد گروه‌بندی نمی‌شود.
                </li>
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
                <Code>/api/tests/sync-anki-words/anki-link-id/deduplicate/start</Code> • <Code>/status</Code> •{" "}
                <Code>/stop</Code>
              </div>
            </section>
          </div>
        ),
      },
      sentence_en: {
        title: "Sync sentence_en + audio",
        body: (
          <div className="space-y-3">
            <div className="text-sm">
              متن را در <Code>sentence_en</Code> و تگ صوت را جداگانه در <Code>sentence_en_audio</Code> سینک می‌کند.
            </div>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">شرایط Update/Skip</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>
                  note بدون <Code>anki_link_id</Code> → <Code>skippedNoLinkId</Code>
                </li>
                <li>
                  DB row برای آن id پیدا نشود → <Code>skippedNoWord</Code>
                </li>
                <li>
                  مقدار جدید دقیقاً برابر مقدار فعلی باشد → <Code>skippedSame</Code>
                </li>
                <li>
                  در غیر این صورت → <Code>updateNoteFields</Code> و <Code>updated += 1</Code>
                </li>
              </ul>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">صوت + Media</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>
                  اگر فایل صوتی محلی معتبر باشد، <Code>[sound:filename]</Code> فقط در <Code>sentence_en_audio</Code>{" "}
                  قرار می‌گیرد.
                </li>
                <li>این دکمه فایل صوتی را به Anki media آپلود/حذف نمی‌کند (فقط متن را آپدیت می‌کند).</li>
                <li>
                  برای همگام‌سازی فایل‌ها با Anki media از دکمه‌ی <Code>Copy all media</Code> استفاده کنید.
                </li>
              </ul>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">API</div>
              <div className="mt-2 text-sm">
                <Code>/api/tests/sync-anki-words/sentence-en/sync-all/start</Code> • <Code>/status</Code> •{" "}
                <Code>/stop</Code>
              </div>
            </section>
          </div>
        ),
      },
      sentence_en_meaning_fa: {
        title: "Sync sentence_en_meaning_fa + audio",
        body: (
          <div className="space-y-3">
            <div className="text-sm">
              متن <Code>sentence_en_meaning_fa</Code> و صوت <Code>sentence_en_meaning_fa_audio</Code> را در دو فیلد
              مستقل سینک می‌کند.
            </div>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">شرایط Update/Skip</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>
                  بدون <Code>anki_link_id</Code> → skippedNoLinkId
                </li>
                <li>بدون DB row → skippedNoWord</li>
                <li>عدم تغییر مقدار → skippedSame</li>
                <li>در غیر این صورت → updateNoteFields</li>
              </ul>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">صوت + Media</div>
              <div className="mt-2 text-sm">
                اگر فایل صوتی محلی معتبر باشد، tag <Code>[sound:...]</Code> فقط در فیلد صوت قرار می‌گیرد. این دکمه فایل
                را آپلود/حذف نمی‌کند؛ آپلود با <Code>Copy all media</Code> انجام می‌شود.
              </div>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">API</div>
              <div className="mt-2 text-sm">
                <Code>/api/tests/sync-anki-words/sentence-en-meaning-fa/sync-all/start</Code> • <Code>/status</Code> •{" "}
                <Code>/stop</Code>
              </div>
            </section>
          </div>
        ),
      },
      meaning_fa: {
        title: "Sync meaning_fa + audio",
        body: (
          <div className="space-y-3">
            <div className="text-sm">
              <Code>meaning_fa</Code> و <Code>meaning_fa_audio</Code> را با هم و در دو فیلد مستقل سینک می‌کند.
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
                <li>متن از معنی اصلی و صوت از فایل رکورد مالک PersianWord تولید می‌شود.</li>
                <li>
                  اگر مقدار جدید دقیقاً برابر مقدار فعلی Anki باشد → <Code>skippedSame</Code>
                </li>
                <li>
                  در غیر این صورت → <Code>updateNoteFields</Code> و <Code>updated += 1</Code>
                </li>
              </ul>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">قانون sound tag</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>نام فایل صوتی از رکورد مالک آن در دیتابیس خوانده می‌شود و فقط همان فایلِ ثبت‌شده سینک می‌شود.</li>
                <li>
                  صوتِ معنی در فیلد مستقل <Code>meaning_fa_audio</Code> سینک می‌شود، نه داخل متن معنی.
                </li>
              </ul>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">Media</div>
              <div className="mt-2 text-sm">
                این دکمه هیچ عملیات آپلود/حذف مدیا انجام نمی‌دهد. اگر متن شامل <Code>[sound:...]</Code> است،
                وجود/به‌روزرسانی فایل‌ها در Anki media به عهده‌ی <Code>Copy all media</Code> است.
              </div>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">API</div>
              <div className="mt-2 text-sm">
                <Code>/api/tests/sync-anki-words/meaning-fa/sync-all/start</Code> • <Code>/status</Code> •{" "}
                <Code>/stop</Code>
              </div>
            </section>
          </div>
        ),
      },
      other_meanings_fa: {
        title: "Sync other_meanings_fa + audio",
        body: (
          <div className="space-y-3">
            <div className="text-sm">
              <Code>other_meanings_fa</Code> و <Code>other_meanings_fa_audio</Code> را با حفظ ترتیب{" "}
              <Code>otherMeaningIds</Code>
              سینک می‌کند و فقط فیلدهای تغییرکرده را می‌نویسد.
            </div>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">شرایط Update/Skip</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>
                  بدون <Code>anki_link_id</Code> → skippedNoLinkId
                </li>
                <li>بدون DB row → skippedNoWord</li>
                <li>بدون تغییر → skippedSame</li>
              </ul>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">صوت + Media</div>
              <div className="mt-2 text-sm">
                صوت‌ها در فیلد مستقل <Code>other_meanings_fa_audio</Code> و به ترتیب <Code>otherMeaningIds</Code> قرار
                می‌گیرند. این دکمه فایل مدیا را کپی نمی‌کند؛ برای آن از <Code>Copy all media</Code> استفاده کنید.
              </div>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">API</div>
              <div className="mt-2 text-sm">
                <Code>/api/tests/sync-anki-words/other-meanings-fa/sync-all/start</Code> • <Code>/status</Code> •{" "}
                <Code>/stop</Code>
              </div>
            </section>
          </div>
        ),
      },
      concept_explained_fa: {
        title: "Sync concept_explained_fa + audio",
        body: (
          <div className="space-y-3">
            <div className="text-sm">
              متن <Code>concept_explained_fa</Code> و صوت <Code>concept_explained_fa_audio</Code> را در دو فیلد مستقل
              سینک می‌کند.
            </div>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">شرایط Update/Skip</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>
                  بدون <Code>anki_link_id</Code> → skippedNoLinkId
                </li>
                <li>بدون DB row → skippedNoWord</li>
                <li>بدون تغییر → skippedSame</li>
              </ul>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">صوت + Media</div>
              <div className="mt-2 text-sm">
                اگر صوت محلی معتبر باشد، <Code>[sound:...]</Code> فقط در <Code>concept_explained_fa_audio</Code> نوشته
                می‌شود. این دکمه فایل را آپلود/حذف نمی‌کند و باید با <Code>Copy all media</Code> انجام شود.
              </div>
            </section>

            <section className="rounded border p-3">
              <div className="text-xs font-semibold">API</div>
              <div className="mt-2 text-sm">
                <Code>/api/tests/sync-anki-words/concept-explained-fa/sync-all/start</Code> • <Code>/status</Code> •{" "}
                <Code>/stop</Code>
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
    const res = await client.requestPermission();
    if (!res.ok) {
      append({
        level: "error",
        message: "requestPermission failed",
        data: res.error,
      });
      return;
    }
    const permission = res.result?.permission ?? "unknown";
    setPermissionText(permission);
    append({ level: "info", message: `Permission: ${permission}` });
  }

  async function startSyncJsonHint() {
    if (isRunning || anySyncRunning) return;
    setIsRunning(true);
    setPreview(null);

    try {
      append({
        level: "info",
        message: "Starting sync json_hint (all notes)...",
      });
      const res = await fetch("/api/tests/sync-anki-words/json-hint/sync-all/start", { method: "POST" });
      const data = (await res.json()) as { status?: SyncAllStatus } | unknown;
      setPreview(data);
      if (data && typeof data === "object" && "status" in data) {
        const s = (data as { status?: SyncAllStatus }).status ?? null;
        setJsonHintStatus(s);
      }
      append({
        level: res.ok ? "info" : "error",
        message: "Start result",
        data,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      append({ level: "error", message: "Unexpected error", data: message });
    } finally {
      setIsRunning(false);
    }
  }

  async function startSyncSentenceEn() {
    if (isRunning || anySyncRunning) return;
    setIsRunning(true);
    setPreview(null);

    try {
      append({
        level: "info",
        message: "Starting sync sentence_en + audio (all notes)...",
      });
      const res = await fetch("/api/tests/sync-anki-words/sentence-en/sync-all/start", { method: "POST" });
      const data = (await res.json()) as { status?: SyncAllStatus } | unknown;
      setPreview(data);
      if (data && typeof data === "object" && "status" in data) {
        const s = (data as { status?: SyncAllStatus }).status ?? null;
        setSentenceEnStatus(s);
      }
      append({
        level: res.ok ? "info" : "error",
        message: "Start result",
        data,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      append({ level: "error", message: "Unexpected error", data: message });
    } finally {
      setIsRunning(false);
    }
  }

  async function startSyncSentenceEnMeaningFa() {
    if (isRunning || anySyncRunning) return;
    setIsRunning(true);
    setPreview(null);

    try {
      append({
        level: "info",
        message: "Starting sync sentence_en_meaning_fa + audio (all notes)...",
      });
      const res = await fetch("/api/tests/sync-anki-words/sentence-en-meaning-fa/sync-all/start", { method: "POST" });
      const data = (await res.json()) as { status?: SyncAllStatus } | unknown;
      setPreview(data);
      if (data && typeof data === "object" && "status" in data) {
        const s = (data as { status?: SyncAllStatus }).status ?? null;
        setSentenceEnMeaningFaStatus(s);
      }
      append({
        level: res.ok ? "info" : "error",
        message: "Start result",
        data,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      append({ level: "error", message: "Unexpected error", data: message });
    } finally {
      setIsRunning(false);
    }
  }

  async function startSyncOtherMeaningsFa() {
    if (isRunning || anySyncRunning) return;
    setIsRunning(true);
    setPreview(null);

    try {
      append({
        level: "info",
        message: "Starting sync other_meanings_fa + audio (all notes)...",
      });
      const res = await fetch("/api/tests/sync-anki-words/other-meanings-fa/sync-all/start", { method: "POST" });
      const data = (await res.json()) as { status?: SyncAllStatus } | unknown;
      setPreview(data);
      if (data && typeof data === "object" && "status" in data) {
        const s = (data as { status?: SyncAllStatus }).status ?? null;
        setOtherMeaningsFaStatus(s);
      }
      append({
        level: res.ok ? "info" : "error",
        message: "Start result",
        data,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      append({ level: "error", message: "Unexpected error", data: message });
    } finally {
      setIsRunning(false);
    }
  }

  async function startSyncConceptExplainedFa() {
    if (isRunning || anySyncRunning) return;
    setIsRunning(true);
    setPreview(null);

    try {
      append({
        level: "info",
        message: "Starting sync concept_explained_fa + audio (all notes)...",
      });
      const res = await fetch("/api/tests/sync-anki-words/concept-explained-fa/sync-all/start", { method: "POST" });
      const data = (await res.json()) as { status?: SyncAllStatus } | unknown;
      setPreview(data);
      if (data && typeof data === "object" && "status" in data) {
        const s = (data as { status?: SyncAllStatus }).status ?? null;
        setConceptExplainedFaStatus(s);
      }
      append({
        level: res.ok ? "info" : "error",
        message: "Start result",
        data,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      append({ level: "error", message: "Unexpected error", data: message });
    } finally {
      setIsRunning(false);
    }
  }

  async function startSyncMeaningFa() {
    if (isRunning || anySyncRunning) return;
    setIsRunning(true);
    setPreview(null);

    try {
      append({
        level: "info",
        message: "Starting sync meaning_fa + audio (all notes)...",
      });
      const res = await fetch("/api/tests/sync-anki-words/meaning-fa/sync-all/start", { method: "POST" });
      const data = (await res.json()) as { status?: SyncAllStatus } | unknown;
      setPreview(data);
      if (data && typeof data === "object" && "status" in data) {
        const s = (data as { status?: SyncAllStatus }).status ?? null;
        setMeaningFaStatus(s);
      }
      append({
        level: res.ok ? "info" : "error",
        message: "Start result",
        data,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      append({ level: "error", message: "Unexpected error", data: message });
    } finally {
      setIsRunning(false);
    }
  }

  async function startSyncAllMedia(mode: "missing" | "changed" = "missing") {
    if (isRunning || anySyncRunning) return;
    setIsRunning(true);
    setPreview(null);

    try {
      append({
        level: "info",
        message:
          mode === "changed"
            ? "Starting changed media copy (different file content)..."
            : "Starting recursive public/audio media copy...",
      });
      const endpoint =
        mode === "changed"
          ? "/api/tests/sync-anki-words/media/sync-changed/start"
          : "/api/tests/sync-anki-words/media/sync-all/start";
      const res = await fetch(endpoint, { method: "POST" });
      const data = (await res.json()) as { status?: SyncAllStatus } | unknown;
      setPreview(data);
      if (data && typeof data === "object" && "status" in data) {
        const s = (data as { status?: SyncAllStatus }).status ?? null;
        setMediaSyncStatus(s);
      }
      append({
        level: res.ok ? "info" : "error",
        message: "Start result",
        data,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      append({ level: "error", message: "Unexpected error", data: message });
    } finally {
      setIsRunning(false);
    }
  }

  async function startFullSyncAll() {
    if (isRunning || anySyncRunning) return;
    setIsRunning(true);
    setPreview(null);

    try {
      append({
        level: "info",
        message: "Starting optimized FULL sync (DB -> Anki)...",
      });
      const res = await fetch("/api/tests/sync-anki-words/full/sync-all/start", {
        method: "POST",
      });
      const data = (await res.json()) as { status?: SyncAllStatus } | unknown;
      setPreview(data);
      if (data && typeof data === "object" && "status" in data) {
        const s = (data as { status?: SyncAllStatus }).status ?? null;
        setFullSyncStatus(s);
      }
      append({
        level: res.ok ? "info" : "error",
        message: "Start result",
        data,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      append({ level: "error", message: "Unexpected error", data: message });
    } finally {
      setIsRunning(false);
    }
  }

  async function deduplicateAnkiLinkIdKeepOldest() {
    if (isRunning || anySyncRunning) return;
    setIsRunning(true);
    setPreview(null);

    try {
      append({
        level: "info",
        message: "Deduplicating notes by anki_link_id (keep oldest noteId)...",
      });
      const res = await fetch("/api/tests/sync-anki-words/anki-link-id/deduplicate/start", { method: "POST" });
      const data = (await res.json()) as { status?: SyncAllStatus } | unknown;
      setPreview(data);
      if (data && typeof data === "object" && "status" in data) {
        const s = (data as { status?: SyncAllStatus }).status ?? null;
        setDedupStatus(s);
      }
      append({
        level: res.ok ? "info" : "error",
        message: "Start result",
        data,
      });
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
        body: JSON.stringify({ limit: 50_000 }),
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
      append({
        level: "error",
        message: "Failed to load Anki notes missing in DB",
        data: message,
      });
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
        body: JSON.stringify({
          noteIds: missingDeleteItems.map((item) => item.noteId),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        deleted?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);

      append({
        level: "info",
        message: `Deleted ${data.deleted ?? 0} Anki note(s) missing in DB.`,
        data,
      });
      const deleted = data.deleted ?? missingDeleteItems.length;
      setMissingDeleteItems([]);
      setMissingDeleteTotalNotes((current) => (current === null ? null : Math.max(0, current - deleted)));
      setMissingDeleteCheckedNotes((current) => (current === null ? null : Math.max(0, current - deleted)));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setMissingDeleteError(message);
      append({
        level: "error",
        message: "Failed to delete Anki notes missing in DB",
        data: message,
      });
    } finally {
      setMissingDeleteDeleting(false);
    }
  }

  useEffect(() => {
    const statuses = progress.statuses;
    setJsonHintStatus((statuses[JOB_PROGRESS_TOPICS.ankiJsonHint] as SyncAllStatus) ?? null);
    setMediaSyncStatus((statuses[JOB_PROGRESS_TOPICS.ankiMedia] as SyncAllStatus) ?? null);
    setFullSyncStatus((statuses[JOB_PROGRESS_TOPICS.ankiFull] as SyncAllStatus) ?? null);
    setDedupStatus((statuses[JOB_PROGRESS_TOPICS.ankiLinkIdDedup] as SyncAllStatus) ?? null);
    setOtherMeaningsFaStatus((statuses[JOB_PROGRESS_TOPICS.ankiOtherMeaningsFa] as SyncAllStatus) ?? null);
    setConceptExplainedFaStatus((statuses[JOB_PROGRESS_TOPICS.ankiConceptExplainedFa] as SyncAllStatus) ?? null);
    setMeaningFaStatus((statuses[JOB_PROGRESS_TOPICS.ankiMeaningFa] as SyncAllStatus) ?? null);
    setSentenceEnStatus((statuses[JOB_PROGRESS_TOPICS.ankiSentenceEn] as SyncAllStatus) ?? null);
    setSentenceEnMeaningFaStatus((statuses[JOB_PROGRESS_TOPICS.ankiSentenceEnMeaningFa] as SyncAllStatus) ?? null);
  }, [progress.statuses]);

  const sentenceEnSkippedTotal =
    (sentenceEnStatus?.skippedSame ?? 0) +
    (sentenceEnStatus?.skippedNoLinkId ?? 0) +
    (sentenceEnStatus?.skippedNoWord ?? 0);

  const jsonHintSkippedTotal =
    (jsonHintStatus?.skippedSame ?? 0) + (jsonHintStatus?.skippedNoLinkId ?? 0) + (jsonHintStatus?.skippedNoWord ?? 0);

  const mediaSkippedTotal =
    (mediaSyncStatus?.skippedSame ?? 0) +
    (mediaSyncStatus?.skippedNoLinkId ?? 0) +
    (mediaSyncStatus?.skippedNoWord ?? 0);

  const fullSkippedTotal =
    (fullSyncStatus?.skippedSame ?? 0) + (fullSyncStatus?.skippedNoLinkId ?? 0) + (fullSyncStatus?.skippedNoWord ?? 0);

  const dedupSkippedTotal =
    (dedupStatus?.skippedSame ?? 0) + (dedupStatus?.skippedNoLinkId ?? 0) + (dedupStatus?.skippedNoWord ?? 0);

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

  const anySyncRunning =
    [
      jsonHintStatus,
      mediaSyncStatus,
      fullSyncStatus,
      dedupStatus,
      sentenceEnStatus,
      sentenceEnMeaningFaStatus,
      meaningFaStatus,
      otherMeaningsFaStatus,
      conceptExplainedFaStatus,
    ].some((status) => status?.running) || missingDeleteDeleting;

  return (
    <main className="mx-auto w-full max-w-6xl select-text p-4">
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Anki Word Synchronization"
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
                  disabled={isRunning || anySyncRunning}
                  className="h-10 rounded-xl bg-foreground px-3 text-sm font-semibold text-background transition disabled:opacity-50"
                >
                  Sync json_hint
                </button>
                <HelpButton id="json_hint" />
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void startSyncAllMedia()}
                  disabled={isRunning || anySyncRunning}
                  className="h-10 rounded-xl bg-foreground px-3 text-sm font-semibold text-background transition disabled:opacity-50"
                >
                  Copy all media
                </button>
                <button
                  type="button"
                  onClick={() => void startSyncAllMedia("changed")}
                  disabled={isRunning || anySyncRunning}
                  className="h-10 rounded-xl border border-card bg-background px-3 text-sm font-semibold text-foreground transition disabled:opacity-50"
                >
                  Copy changed media
                </button>
                <HelpButton id="media_copy" />
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void startFullSyncAll()}
                  disabled={isRunning || anySyncRunning}
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
                  disabled={isRunning || anySyncRunning}
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
                  disabled={anySyncRunning || missingDeleteLoading || missingDeleteDeleting}
                  className="h-10 rounded-xl border border-red-500/30 bg-red-600/10 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-600/15 disabled:opacity-50 dark:text-red-300"
                >
                  Delete Anki notes missing in DB
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void startSyncSentenceEn()}
                  disabled={isRunning || anySyncRunning}
                  className="h-10 rounded-xl bg-foreground px-3 text-sm font-semibold text-background transition disabled:opacity-50"
                >
                  Sync sentence_en + audio
                </button>
                <HelpButton id="sentence_en" />
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void startSyncSentenceEnMeaningFa()}
                  disabled={isRunning || anySyncRunning}
                  className="h-10 rounded-xl bg-foreground px-3 text-sm font-semibold text-background transition disabled:opacity-50"
                >
                  Sync sentence_en_meaning_fa + audio
                </button>
                <HelpButton id="sentence_en_meaning_fa" />
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void startSyncMeaningFa()}
                  disabled={isRunning || anySyncRunning}
                  className="h-10 rounded-xl bg-foreground px-3 text-sm font-semibold text-background transition disabled:opacity-50"
                >
                  Sync meaning_fa + audio
                </button>
                <HelpButton id="meaning_fa" />
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void startSyncOtherMeaningsFa()}
                  disabled={isRunning || anySyncRunning}
                  className="h-10 rounded-xl bg-foreground px-3 text-sm font-semibold text-background transition disabled:opacity-50"
                >
                  Sync other_meanings_fa + audio
                </button>
                <HelpButton id="other_meanings_fa" />
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void startSyncConceptExplainedFa()}
                  disabled={isRunning || anySyncRunning}
                  className="h-10 rounded-xl bg-foreground px-3 text-sm font-semibold text-background transition disabled:opacity-50"
                >
                  Sync concept_explained_fa + audio
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
                      صفحه: <Code>/anki/sync/words</Code>
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
                      پیدا شده: <span className="font-semibold">{missingDeleteItems.length}</span> • بررسی‌شده:{" "}
                      <span className="font-semibold">{missingDeleteCheckedNotes ?? "—"}</span> • کل نوت‌های query:{" "}
                      <span className="font-semibold">{missingDeleteTotalNotes ?? "—"}</span>
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
                            <td className="whitespace-nowrap px-3 py-2 font-mono text-neutral-800">
                              {item.anki_link_id}
                            </td>
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
                    {missingDeleteDeleting ? "در حال حذف..." : `حذف همه از Anki (${missingDeleteItems.length})`}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-1 text-xs text-muted">
            <div>
              {jsonHintStatus ? (
                <span>
                  json_hint: Processed{" "}
                  <span className="font-semibold">
                    {jsonHintStatus.processed}/{jsonHintStatus.total}
                  </span>{" "}
                  • Updated <span className="font-semibold">{jsonHintStatus.updated}</span> • Skipped{" "}
                  <span className="font-semibold">{jsonHintSkippedTotal}</span> • Failed{" "}
                  <span className="font-semibold">{jsonHintStatus.failed}</span>
                </span>
              ) : (
                <span>json_hint: Processed 0/0 • Updated 0 • Skipped 0 • Failed 0</span>
              )}
            </div>
            <div>
              {mediaSyncStatus ? (
                <span>
                  media copy: Processed{" "}
                  <span className="font-semibold">
                    {mediaSyncStatus.processed}/{mediaSyncStatus.total}
                  </span>{" "}
                  • Uploaded <span className="font-semibold">{mediaSyncStatus.mediaUploaded}</span> • Skipped{" "}
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
                  <span className="font-semibold">
                    {fullSyncStatus.processed}/{fullSyncStatus.total}
                  </span>{" "}
                  • Created <span className="font-semibold">{fullSyncStatus.created ?? 0}</span> • Updated{" "}
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
                  <span className="font-semibold">
                    {dedupStatus.processed}/{dedupStatus.total}
                  </span>{" "}
                  • Deleted <span className="font-semibold">{dedupStatus.updated}</span> • Kept{" "}
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
                  sentence_en + audio: Processed{" "}
                  <span className="font-semibold">
                    {sentenceEnStatus.processed}/{sentenceEnStatus.total}
                  </span>{" "}
                  • Updated <span className="font-semibold">{sentenceEnStatus.updated}</span> • Skipped{" "}
                  <span className="font-semibold">{sentenceEnSkippedTotal}</span> • Failed{" "}
                  <span className="font-semibold">{sentenceEnStatus.failed}</span>
                </span>
              ) : (
                <span>sentence_en + audio: Processed 0/0 • Updated 0 • Skipped 0 • Failed 0</span>
              )}
            </div>
            <div>
              {sentenceEnMeaningFaStatus ? (
                <span>
                  sentence_en_meaning_fa + audio: Processed{" "}
                  <span className="font-semibold">
                    {sentenceEnMeaningFaStatus.processed}/{sentenceEnMeaningFaStatus.total}
                  </span>{" "}
                  • Updated <span className="font-semibold">{sentenceEnMeaningFaStatus.updated}</span> • Skipped{" "}
                  <span className="font-semibold">{sentenceSkippedTotal}</span> • Failed{" "}
                  <span className="font-semibold">{sentenceEnMeaningFaStatus.failed}</span>
                </span>
              ) : (
                <span>sentence_en_meaning_fa + audio: Processed 0/0 • Updated 0 • Skipped 0 • Failed 0</span>
              )}
            </div>
            <div>
              {meaningFaStatus ? (
                <span>
                  meaning_fa + audio: Processed{" "}
                  <span className="font-semibold">
                    {meaningFaStatus.processed}/{meaningFaStatus.total}
                  </span>{" "}
                  • Updated <span className="font-semibold">{meaningFaStatus.updated}</span> • Skipped{" "}
                  <span className="font-semibold">{meaningSkippedTotal}</span> • Failed{" "}
                  <span className="font-semibold">{meaningFaStatus.failed}</span>
                </span>
              ) : (
                <span>meaning_fa + audio: Processed 0/0 • Updated 0 • Skipped 0 • Failed 0</span>
              )}
            </div>
            <div>
              {conceptExplainedFaStatus ? (
                <span>
                  concept_explained_fa + audio: Processed{" "}
                  <span className="font-semibold">
                    {conceptExplainedFaStatus.processed}/{conceptExplainedFaStatus.total}
                  </span>{" "}
                  • Updated <span className="font-semibold">{conceptExplainedFaStatus.updated}</span> • Skipped{" "}
                  <span className="font-semibold">{conceptSkippedTotal}</span> • Failed{" "}
                  <span className="font-semibold">{conceptExplainedFaStatus.failed}</span>
                </span>
              ) : (
                <span>concept_explained_fa + audio: Processed 0/0 • Updated 0 • Skipped 0 • Failed 0</span>
              )}
            </div>
            <div>
              {otherMeaningsFaStatus ? (
                <span>
                  other_meanings_fa + audio: Processed{" "}
                  <span className="font-semibold">
                    {otherMeaningsFaStatus.processed}/{otherMeaningsFaStatus.total}
                  </span>{" "}
                  • Updated <span className="font-semibold">{otherMeaningsFaStatus.updated}</span> • Skipped{" "}
                  <span className="font-semibold">{otherSkippedTotal}</span> • Failed{" "}
                  <span className="font-semibold">{otherMeaningsFaStatus.failed}</span>
                </span>
              ) : (
                <span>other_meanings_fa + audio: Processed 0/0 • Updated 0 • Skipped 0 • Failed 0</span>
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
