// Students are stored as a single "first last" fullName. Rosters are shown
// sorted by family (last) name, not first name - e.g. "יעל אורן" (family
// name אורן) before "אפרת כהן" (family name כהן).
function familyNameOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1] ?? fullName;
}

export function compareByFamilyName(a: { fullName: string }, b: { fullName: string }): number {
  const byFamily = familyNameOf(a.fullName).localeCompare(familyNameOf(b.fullName), 'he');
  if (byFamily !== 0) return byFamily;
  return a.fullName.localeCompare(b.fullName, 'he');
}

export function sortByFamilyName<T extends { fullName: string }>(list: T[]): T[] {
  return [...list].sort(compareByFamilyName);
}
