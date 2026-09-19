export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const assets = (query.get("assets") ?? "").split(",");
  if (Array.from(query.keys()).some((key) => key !== "assets") || query.getAll("assets").length !== 1 ||
      assets.length > 200 || assets.some((id) => !/^[a-z0-9][a-z0-9-]{0,99}$/.test(id))) {
    return Response.json({ error: "Invalid asset subscription." }, { status: 400 });
  }
  const apiKey = process.env.COINCAP_API_KEY?.trim();
  if (!apiKey) return Response.json({ error: "Crypto streaming is not configured." }, { status: 503 });
  if (typeof WebSocket === "undefined") {
    return Response.json({ error: "Crypto streaming requires Node.js 22 or later." }, { status: 503 });
  }

  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let socket: WebSocket | undefined;
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      let deadline: ReturnType<typeof setTimeout> | undefined;
      let connectTimeout: ReturnType<typeof setTimeout> | undefined;
      const send = (event: string, data: unknown) => {
        if (!closed) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const onAbort = () => finish();
      const finish = (closeController = true) => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        clearTimeout(deadline);
        clearTimeout(connectTimeout);
        request.signal.removeEventListener("abort", onAbort);
        if (socket) {
          socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
          socket.close();
        }
        if (closeController) controller.close();
      };
      cleanup = () => finish(false);
      request.signal.addEventListener("abort", onAbort, { once: true });
      if (request.signal.aborted) { finish(); return; }
      const fail = () => {
        send("provider-error", { error: "Live prices are unavailable. Check CoinCap access and WebSocket plan support." });
        finish();
      };
      try {
        const url = new URL("wss://wss.coincap.io/prices");
        url.searchParams.set("assets", Array.from(new Set(assets)).sort().join(","));
        url.searchParams.set("apiKey", apiKey);
        socket = new WebSocket(url);
        socket.onopen = () => { clearTimeout(connectTimeout); send("ready", {}); };
        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(String(event.data));
            const prices: Record<string, string> = {};
            for (const id of assets) {
              if (typeof data?.[id] === "string" && Number.isFinite(Number(data[id])) && Number(data[id]) > 0) {
                prices[id] = data[id];
              }
            }
            if (Object.keys(prices).length) send("message", prices);
            else if (data?.error) fail();
          } catch { fail(); }
        };
        socket.onerror = fail;
        socket.onclose = fail;
        connectTimeout = setTimeout(fail, 8_000);
        heartbeat = setInterval(() => {
          if (!closed) controller.enqueue(encoder.encode(": heartbeat\n\n"));
        }, 10_000);
        // Renew before the deployment's 30-second function timeout.
        deadline = setTimeout(() => { send("reconnect", {}); finish(); }, 25_000);
      } catch { fail(); }
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, { headers: {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-store, no-transform",
    "X-Accel-Buffering": "no",
  } });
}
