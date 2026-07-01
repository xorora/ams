export function maskBankAccount(accountNumber: string): string {
  const trimmed = accountNumber.trim();
  if (trimmed.length <= 4) {
    return "****";
  }
  return `****${trimmed.slice(-4)}`;
}

export function formatMaskedTransferDetails(
  bankName?: string | null,
  bankAccountNumber?: string | null,
): string | null {
  const name = bankName?.trim();
  const account = bankAccountNumber?.trim();

  if (name && account) {
    return `${name} - ${maskBankAccount(account)}`;
  }
  if (name) {
    return name;
  }
  if (account) {
    return maskBankAccount(account);
  }
  return null;
}

export function maskTransferDetails(transferDetails: string | null): string | null {
  if (!transferDetails) {
    return null;
  }

  const separatorIndex = transferDetails.lastIndexOf(" - ");
  if (separatorIndex === -1) {
    return maskBankAccount(transferDetails);
  }

  const bankName = transferDetails.slice(0, separatorIndex);
  const account = transferDetails.slice(separatorIndex + 3);
  return formatMaskedTransferDetails(bankName, account);
}
