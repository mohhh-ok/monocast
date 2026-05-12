import { NextResponse } from "next/server";
import { listPrograms } from "@/lib/queue";

export const dynamic = "force-dynamic";

export async function GET() {
  const programs = await listPrograms();
  return NextResponse.json({ programs });
}
