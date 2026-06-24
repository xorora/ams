const PLAIN_TEXT_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-store",
  Pragma: "no-cache",
} as const;

export function admsTextResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: PLAIN_TEXT_HEADERS,
  });
}

export function admsOk(processedCount?: number): Response {
  if (processedCount === undefined) {
    return admsTextResponse("OK");
  }
  return admsTextResponse(`OK:${processedCount}`);
}

export function admsError(message: string, status = 400): Response {
  return admsTextResponse(message, status);
}
