export function formatINR(amountInPaise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: amountInPaise % 100 === 0 ? 0 : 2,
  }).format(amountInPaise / 100);
}

export function parseRupeesToPaise(value: FormDataEntryValue | null) {
  const numberValue = Number(value ?? 0);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return 0;
  }

  return Math.round(numberValue * 100);
}
