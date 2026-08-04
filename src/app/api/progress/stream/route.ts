import { getJobProgressSnapshot } from "@/lib/progress/jobProgressCatalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();
const UPDATE_INTERVAL_MS = 250;
const HEARTBEAT_INTERVAL_MS = 15_000;

function sseEvent(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function GET(request: Request) {
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let previous = "";

      const sendSnapshot = () => {
        if (closed) return;
        const statuses = getJobProgressSnapshot();
        const serialized = JSON.stringify(statuses);
        if (serialized === previous) return;
        previous = serialized;
        controller.enqueue(sseEvent("snapshot", { statuses }));
      };

      controller.enqueue(encoder.encode("retry: 2000\n\n"));
      sendSnapshot();

      const updateTimer = setInterval(sendSnapshot, UPDATE_INTERVAL_MS);
      const heartbeatTimer = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
      }, HEARTBEAT_INTERVAL_MS);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(updateTimer);
        clearInterval(heartbeatTimer);
      };

      request.signal.addEventListener("abort", cleanup, { once: true });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

