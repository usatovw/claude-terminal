import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("auth-token")?.value;
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const tm = (global as Record<string, unknown>).terminalManager as {
    killSession: (id: string) => boolean;
  };
  const killed = tm.killSession(id);

  if (killed) {
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: "Session not found" }, { status: 404 });
}
