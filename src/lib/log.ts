function ts(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

function write(level: "info" | "warn" | "error", tag: string, msg: string) {
  const line = `[${ts()}] [${level}] [${tag}] ${msg}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (tag: string, msg: string) => write("info", tag, msg),
  warn: (tag: string, msg: string) => write("warn", tag, msg),
  error: (tag: string, msg: string) => write("error", tag, msg),
};
