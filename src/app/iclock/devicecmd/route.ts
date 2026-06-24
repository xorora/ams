import { authorizeDeviceRequest } from "@/lib/zkteco/adms/handler";
import { parseDeviceCmdBody } from "@/lib/zkteco/adms/parser";
import { readBodyText } from "@/lib/zkteco/adms/request";
import { admsError, admsOk } from "@/lib/zkteco/adms/responses";
import { completeCommandByWireId } from "@/lib/zkteco/device-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const auth = await authorizeDeviceRequest(request);

    if (auth instanceof Response) {
      return auth;
    }

    const body = await readBodyText(request);
    const results = parseDeviceCmdBody(body);

    for (const result of results) {
      await completeCommandByWireId(
        auth.device.id,
        result.id,
        result.returnCode,
        `Return=${result.returnCode}&CMD=${result.command}`,
      );
    }

    return admsOk();
  } catch (error) {
    console.error("[iclock/devicecmd]", error);
    return admsError("Internal Server Error", 500);
  }
}
