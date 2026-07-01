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

async function readPdfResponseBlob(
  response: Response,
  fallbackFilename: string,
): Promise<{ blob: Blob; filename: string }> {
  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "PDF request failed");
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition");
  const match = disposition?.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? fallbackFilename;

  return { blob, filename };
}

export async function downloadResponseBlob(
  response: Response,
  fallbackFilename: string,
): Promise<string> {
  const { blob, filename } = await readPdfResponseBlob(response, fallbackFilename);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return filename;
}

export async function previewResponseBlob(
  response: Response,
  fallbackFilename: string,
): Promise<string> {
  const { blob, filename } = await readPdfResponseBlob(response, fallbackFilename);
  const url = URL.createObjectURL(blob);
  const previewWindow = window.open(url, "_blank", "noopener,noreferrer");
  if (!previewWindow) {
    URL.revokeObjectURL(url);
    throw new Error("Pop-up blocked. Allow pop-ups to preview the PDF.");
  }
  previewWindow.addEventListener("beforeunload", () => URL.revokeObjectURL(url));
  return filename;
}
