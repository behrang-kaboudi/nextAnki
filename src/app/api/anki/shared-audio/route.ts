import "server-only";

import { NextResponse } from "next/server";

import {
  createSilenceFile,
  deleteSharedAudioFile,
  editSharedAudioFile,
  listSharedAudioFiles,
  renameSharedAudioFile,
  saveSharedAudioRecording,
  saveSharedAudioUpload,
} from "@/lib/anki/sharedAudioFiles.server";

export const runtime = "nodejs";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Could not manage the audio file.";
  const status = (error as NodeJS.ErrnoException | null)?.code === "ENOENT" ? 404 : 400;
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET() {
  try {
    return NextResponse.json({ ok: true, files: await listSharedAudioFiles() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "An audio file is required." }, { status: 400 });
      if (form.get("action") === "recording") {
        const name = await saveSharedAudioRecording(file, form.get("name"), form.get("replaceName"));
        return NextResponse.json({ ok: true, name });
      }
      const name = await saveSharedAudioUpload(file, form.get("name"));
      return NextResponse.json({ ok: true, name });
    }

    const body = (await request.json().catch(() => null)) as { action?: unknown; name?: unknown; durationSeconds?: unknown } | null;
    if (body?.action !== "silence") return NextResponse.json({ ok: false, error: "Unsupported action." }, { status: 400 });
    const name = await createSilenceFile(body.name, body.durationSeconds);
    return NextResponse.json({ ok: true, name });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      action?: unknown;
      currentName?: unknown;
      nextName?: unknown;
      name?: unknown;
      startSeconds?: unknown;
      endSeconds?: unknown;
      volumePercent?: unknown;
      fadeInSeconds?: unknown;
      fadeOutSeconds?: unknown;
    } | null;
    const name = body?.action === "edit"
      ? await editSharedAudioFile(body.name, body.startSeconds, body.endSeconds, body.volumePercent, body.fadeInSeconds, body.fadeOutSeconds)
      : await renameSharedAudioFile(body?.currentName, body?.nextName);
    return NextResponse.json({ ok: true, name });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
    const name = await deleteSharedAudioFile(body?.name);
    return NextResponse.json({ ok: true, name });
  } catch (error) {
    return errorResponse(error);
  }
}
