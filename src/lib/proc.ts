import { spawn } from "node:child_process";

export type RunProcOptions = {
  /** プロセスの stdin に流し込むテキスト。 */
  stdin?: string;
  /** エラーメッセージ末尾に残す stderr のバイト数。 */
  stderrTail?: number;
};

export type RunProcResult = {
  stdout: string;
  stderr: string;
};

/**
 * 子プロセスを起動し、終了を待って stdout/stderr を返す。
 * 0 以外の exit code、起動失敗は Error として throw する（cause 付き）。
 */
export function runProc(
  bin: string,
  args: string[],
  opts: RunProcOptions = {},
): Promise<RunProcResult> {
  return new Promise((resolve, reject) => {
    const useStdin = opts.stdin !== undefined;
    const proc = spawn(bin, args, {
      stdio: [useStdin ? "pipe" : "ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d) => {
      stdout += d.toString();
    });
    proc.stderr?.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("error", (err) => {
      reject(
        new Error(`${bin} failed to start: ${err.message}`, { cause: err }),
      );
    });
    proc.on("close", (code, signal) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const tail = stderr.slice(-(opts.stderrTail ?? 500));
      const status = code !== null ? `exit ${code}` : `signal ${signal}`;
      reject(new Error(`${bin} failed (${status}): ${tail}`));
    });
    if (useStdin && proc.stdin) {
      proc.stdin.write(opts.stdin!);
      proc.stdin.end();
    }
  });
}
