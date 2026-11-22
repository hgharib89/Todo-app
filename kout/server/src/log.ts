/** Structured JSON logs (one line each), easy to search in `fly logs`. */
type Level = 'info' | 'warn' | 'error';
let sink: (line: string) => void = (line) => console.log(line);
let quiet = false;

export function setLogSink(fn: (line: string) => void) {
  sink = fn;
}
export function setQuiet(q: boolean) {
  quiet = q;
}

export function log(level: Level, event: string, data: Record<string, unknown> = {}) {
  if (quiet && level === 'info') return;
  sink(JSON.stringify({ t: new Date().toISOString(), level, event, ...data }));
}
