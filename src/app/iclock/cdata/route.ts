import { authorizeDeviceRequest } from "@/lib/zkteco/adms/handler";
import { parseAttlogBody, parseDeptInfoBody, parseUserInfoBody } from "@/lib/zkteco/adms/parser";
import { getQueryParam, readBodyText } from "@/lib/zkteco/adms/request";
import { admsError, admsOk, admsTextResponse } from "@/lib/zkteco/adms/responses";
import { ingestAttlogRecords } from "@/lib/zkteco/attendance-ingest";
import { ingestDeptInfoRecords } from "@/lib/zkteco/company-sync";
import { buildHandshakeResponse } from "@/lib/zkteco/device-service";
import { ingestUserInfoRecords } from "@/lib/zkteco/employee-sync";

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
    console.error("[iclock/cdata GET]", error);
    return admsError("Internal Server Error", 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authorizeDeviceRequest(request, {
      ipAddress: getClientIp(request),
    });

    if (auth instanceof Response) {
      return auth;
    }

    const table = getQueryParam(request, "table")?.toUpperCase() ?? "";
    const body = await readBodyText(request);

    if (table === "ATTLOG") {
      const records = parseAttlogBody(body);
      const processed = await ingestAttlogRecords(auth.serialNumber, records);
      return admsOk(processed);
    }

    if (table === "OPERLOG") {
      const userRecords = parseUserInfoBody(body);
      if (userRecords.length > 0) {
        const result = await ingestUserInfoRecords(auth.device.id, userRecords);
        return admsOk(result.processed);
      }
      return admsOk(0);
    }

    if (table === "USERINFO" || table === "USER") {
      const userRecords = parseUserInfoBody(body);
      const result = await ingestUserInfoRecords(auth.device.id, userRecords);
      return admsOk(result.processed);
    }

    if (table === "DEPTINFO" || table === "DEPT") {
      const deptRecords = parseDeptInfoBody(body);
      const processed = await ingestDeptInfoRecords(auth.device.id, deptRecords);
      return admsOk(processed);
    }

    // ATTPHOTO, BIODATA, and other tables — acknowledge without processing.
    return admsOk(0);
  } catch (error) {
    console.error("[iclock/cdata POST]", error);
    return admsError("Internal Server Error", 500);
  }
}
