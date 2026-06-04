import { getWorkspaceDomain } from "@/lib/env";

function resolveWorkspaceDomain(): string | null {
  try {
    return getWorkspaceDomain();
  } catch {
    return null;
  }
}

export function isAllowedWorkspaceEmail(email: string, emailVerified: boolean): boolean {
  if (!emailVerified) {
    return false;
  }

  const workspaceDomain = resolveWorkspaceDomain();
  if (!workspaceDomain) {
    return false;
  }

  const emailDomain = email.split("@")[1]?.toLowerCase();
  return emailDomain === workspaceDomain;
}

export function isAllowedHostedDomain(hd: string | undefined): boolean {
  const workspaceDomain = resolveWorkspaceDomain();
  if (!workspaceDomain) {
    return false;
  }

  return hd?.toLowerCase() === workspaceDomain;
}
