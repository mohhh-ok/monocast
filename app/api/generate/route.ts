import { NextResponse } from "next/server";
import { produceProgram } from "@/lib/produce";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

let inFlight: Promise<unknown> | null = null;

export async function POST() {
  if (inFlight) {
    return NextResponse.json(
      { status: "already-running" },
      { status: 202 },
    );
  }
  const { LLM_PROVIDER } = getEnv();
  const task = (async () => {
    try {
      const program = await produceProgram(LLM_PROVIDER);
      return program;
    } finally {
      inFlight = null;
    }
  })();
  inFlight = task;

  try {
    const program = await task;
    return NextResponse.json({ status: "ok", program });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
