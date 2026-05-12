import { createWriteStream, mkdirSync, type WriteStream } from "node:fs";
import path from "node:path";

type Level = "debug" | "info" | "warn" | "error";

const LOG_FILE = path.join(process.cwd(), ".logs", "app.jsonl");

let stream: WriteStream | null = null;

function ensureStream(): WriteStream {
  if (stream) return stream;
  mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  stream = createWriteStream(LOG_FILE, { flags: "a" });
  return stream;
}

function consoleTs(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

function isoTs(): string {
  const d = new Date();
  const tzMin = -d.getTimezoneOffset();
  const sign = tzMin >= 0 ? "+" : "-";
  const abs = Math.abs(tzMin);
  const tzh = String(Math.floor(abs / 60)).padStart(2, "0");
  const tzm = String(abs % 60).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${yyyy}-${mo}-${da}T${hh}:${mm}:${ss}.${ms}${sign}${tzh}:${tzm}`;
}

type Extra = Record<string, unknown>;

function write(level: Level, tag: string, msg: string, extra?: Extra) {
  const record = { ts: isoTs(), level, tag, msg, ...(extra ?? {}) };
  try {
    ensureStream().write(`${JSON.stringify(record)}\n`);
  } catch {
    // ファイル出力に失敗してもプロセスは止めない
  }

  if (level === "debug") return;
  const line = `[${consoleTs()}] [${level}] [${tag}] ${msg}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (tag: string, msg: string, extra?: Extra) => write("debug", tag, msg, extra),
  info: (tag: string, msg: string, extra?: Extra) => write("info", tag, msg, extra),
  warn: (tag: string, msg: string, extra?: Extra) => write("warn", tag, msg, extra),
  error: (tag: string, msg: string, extra?: Extra) => write("error", tag, msg, extra),
};
