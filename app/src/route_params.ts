/** يفك معرّفات المسار مرة واحدة، ويبقي المسار القديم قابلًا للفتح إن كان ترميزه تالفًا. */
export function decodeRouteParam(value: string): string {
  try { return decodeURIComponent(value) }
  catch { return value }
}
