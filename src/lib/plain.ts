export function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null));
}
