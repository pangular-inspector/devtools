export function time(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}
