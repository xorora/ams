import { authorizeDeviceRequest } from "@/lib/zkteco/adms/handler";
import { isAdmsProbeRequest } from "@/lib/zkteco/adms/request";
import { admsError, admsTextResponse } from "@/lib/zkteco/adms/responses";
import { countPendingCommands, getNextPendingCommand } from "@/lib/zkteco/device-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const auth = await authorizeDeviceRequest(request);

    if (auth instanceof Response) {
      return auth;
    }

    // Probes (verify script, admin checks) must not dequeue commands — only the physical device may.
    if (isAdmsProbeRequest(request)) {
      const pending = await countPendingCommands(auth.device.id);
      return admsTextResponse(`OK pending=${pending}`);
    }

    const command = await getNextPendingCommand(auth.device.id);
    if (!command) {
      return admsTextResponse("OK");
    }

    return admsTextResponse(`${command.commandText}\n`);
  } catch (error) {
    console.error("[iclock/getrequest]", error);
    return admsError("Internal Server Error", 500);
  }
}
