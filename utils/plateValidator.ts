export const SRI_LANKA_PLATE_REGEX = /^(?:[A-Z]{2,3}[- ]\d{4}|[A-Z]{1,2}[- ]\d{4}|(?:[A-Z]{2}\s)?[A-Z]{2,3}[- ]\d{4}|[0-9]{2,3}-\d{4})$/;

export function normalizePlate(input: string | null | undefined): string {
  if (!input) return "";
  // Trim, collapse spaces, uppercase, normalize dash spacing
  const s = String(input).trim().toUpperCase().replace(/\s+/g, " ");
  // Ensure single dash when user used spaces around dash
  return s.replace(/\s*-\s*/g, "-").replace(/\s{2,}/g, " ");
}

export function validateSriLankanPlate(input: string | null | undefined): string {
  const plate = normalizePlate(input);
  if (SRI_LANKA_PLATE_REGEX.test(plate)) return "Valid Sri Lankan vehicle number";
  return "Invalid vehicle number";
}
