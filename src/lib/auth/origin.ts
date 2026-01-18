export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!host) return;
  if (!origin) return;

  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    return;
  }

  if (originHost !== host) {
    throw new Error("Invalid origin");
  }
}

