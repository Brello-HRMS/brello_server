/**
 * Computes the list of keys that differ between two objects.
 * Returns an empty array if either value is absent (e.g. CREATE has no old_value).
 */
export function computeChangedFields(
  oldVal: Record<string, unknown> | null | undefined,
  newVal: Record<string, unknown> | null | undefined,
): string[] {
  if (!oldVal || !newVal) return [];

  const allKeys = new Set([...Object.keys(oldVal), ...Object.keys(newVal)]);

  return [...allKeys].filter(
    (key) => JSON.stringify(oldVal[key]) !== JSON.stringify(newVal[key]),
  );
}
