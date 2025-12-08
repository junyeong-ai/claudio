export function withTiming<T extends object>(data: T, startTime: number): T & { duration_ms: number } {
  return { ...data, duration_ms: Date.now() - startTime };
}
