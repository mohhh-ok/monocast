import { NextResponse } from "next/server";
import { listPrograms, removeProgram } from "@/lib/queue";

export const dynamic = "force-dynamic";

export async function GET() {
  const programs = await listPrograms();
  return NextResponse.json({ programs });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await removeProgram(id);
  return NextResponse.json({ ok: true });
}
