type FailureLike = { ok: false; message: string; code: string };

export type ActionFailure = { ok: false; error: string; code?: string };

export type ActionResult<T = void> = T extends void
  ? { ok: true } | ActionFailure
  : { ok: true; data: T } | ActionFailure;

export function actionFailure(failure: FailureLike): ActionFailure {
  return { ok: false, error: failure.message, code: failure.code };
}

export function actionSuccess(): { ok: true };
export function actionSuccess<T>(data: T): { ok: true; data: T };
export function actionSuccess<T>(data?: T) {
  if (data === undefined) {
    return { ok: true as const };
  }
  return { ok: true as const, data };
}
