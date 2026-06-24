import { getSerialNumber, validateDeviceAuth } from "@/lib/zkteco/adms/request";
import { admsError } from "@/lib/zkteco/adms/responses";
import { type DeviceMetadata, ensureDevice } from "@/lib/zkteco/device-service";

export type AuthorizedDeviceContext = {
  serialNumber: string;
  device: Awaited<ReturnType<typeof ensureDevice>>;
};

export async function authorizeDeviceRequest(
  request: Request,
  metadata: DeviceMetadata = {},
): Promise<AuthorizedDeviceContext | Response> {
  const serialNumber = getSerialNumber(request);
  if (!serialNumber) {
    return admsError("Not Authorized Terminal", 403);
  }

  if (!validateDeviceAuth(request)) {
    return admsError("Not Authorized Terminal", 403);
  }

  const device = await ensureDevice(serialNumber, metadata);
  return { serialNumber, device };
}
