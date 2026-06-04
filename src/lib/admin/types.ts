export type ServiceFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
};

export type ServiceSuccess<T> = { ok: true; data: T };

export function adminFailure(status: number, code: string, message: string): ServiceFailure {
  return { ok: false, status, code, message };
}
