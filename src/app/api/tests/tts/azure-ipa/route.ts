import "server-only";

import { NextResponse } from "next/server";

import { synthesizeAzureIpaSegment } from "@/lib/tts/azureIpaTts.server";

type RequestBody = {
  written?: unknown;
  ipa?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as RequestBody | null;
    const written = typeof body?.written === "string" ? body.written.trim() : "";
    const ipa = typeof body?.ipa === "string" ? body.ipa.trim() : "";

    if (!written || !ipa) {
      return NextResponse.json(
        { ok: false, error: "written and ipa are required" },
        { status: 400 },
      );
    }
    if (written.length > 200 || ipa.length > 200) {
      return NextResponse.json(
        { ok: false, error: "written and ipa must each be 200 characters or fewer" },
        { status: 400 },
      );
    }

    const audio = await synthesizeAzureIpaSegment({ written, ipa });
    return new Response(new Uint8Array(audio), {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
