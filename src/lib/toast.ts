import { toast } from "sonner";

function formatError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function toastSuccess(message: string) {
  toast.success(message);
}

export function toastError(message: string) {
  toast.error(message);
}

export async function toastAsync<T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((value: T) => string);
    error?: string | ((error: unknown) => string);
  },
): Promise<T> {
  toast.promise(promise, {
    loading: messages.loading,
    success: messages.success,
    error: messages.error ?? ((error) => formatError(error, "Something went wrong")),
  });
  return promise;
}

export { toast };

export async function downloadResponseBlob(
  response: Response,
  fallbackFilename: string,
): Promise<string> {
  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Download failed");
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition");
  const match = disposition?.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? fallbackFilename;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return filename;
}
