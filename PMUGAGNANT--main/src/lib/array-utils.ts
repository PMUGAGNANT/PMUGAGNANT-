/** Évite les crashs du type (x ?? []).map quand x est un objet ou une valeur inattendue. */
export function asArray<T>(value: unknown): T[] {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? (value as T[]) : [];
}
