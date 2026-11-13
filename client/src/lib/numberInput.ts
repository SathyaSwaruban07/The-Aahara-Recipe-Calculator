/** Allow clearing numeric fields while typing (empty string instead of forced 0). */
export type NumberDraft = number | "";

export function numberInputValue(value: NumberDraft | undefined | null): number | "" {
  if (value === "" || value === undefined || value === null) return "";
  return value;
}

export function parseNumberInput(raw: string): NumberDraft {
  if (raw === "") return "";
  const n = Number(raw);
  return Number.isFinite(n) ? n : "";
}

export function toRequiredNumber(value: NumberDraft | undefined, fallback = 0): number {
  if (value === "" || value === undefined) return fallback;
  return value;
}
