/**
 * Decode a conversation section epoch from untrusted storage or fence YAML.
 * Missing, non-finite, negative, or non-integer values fail closed to 0.
 */
export function decodeSectionEpoch(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    return 0;
  }
  return value;
}
