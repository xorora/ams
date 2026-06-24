import { authorizeDeviceRequest } from "@/lib/zkteco/adms/handler";
import { parseRegistryBody } from "@/lib/zkteco/adms/parser";
import { getQueryParam, readBodyText } from "@/lib/zkteco/adms/request";
import { admsError, admsOk, admsTextResponse } from "@/lib/zkteco/adms/responses";
import { buildHandshakeResponse } from "@/lib/zkteco/device-service";

export const runtime = "nodejs";

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? null;
  }
  return request.headers.get("x-real-ip");
}

export async function GET(request: Request) {
  try {
    const auth = await authorizeDeviceRequest(request, {
      ipAddress: getClientIp(request),
      pushVersion: getQueryParam(request, "pushver"),
    });

    if (auth instanceof Response) {
      return auth;
    }

    return admsTextResponse(buildHandshakeResponse(auth.serialNumber));
  } catch (error) {
    console.error("[iclock/registry GET]", error);
    return admsError("Internal Server Error", 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readBodyText(request);
    const info = parseRegistryBody(body);

    const auth = await authorizeDeviceRequest(request, {
      ipAddress: info.IPAddress ?? info.ip ?? getClientIp(request),
      firmwareVersion: info.FirmwareVersion ?? info.firmware ?? null,
      pushVersion: getQueryParam(request, "pushver"),
    });

    if (auth instanceof Response) {
      return auth;
    }

    return admsOk();
  } catch (error) {
    console.error("[iclock/registry POST]", error);
    return admsError("Internal Server Error", 500);
  }
}
