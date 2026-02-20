import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

interface TerminalManager {
  killSession: (id: string) => boolean;
  deleteSession: (id: string) => boolean;
  renameSession: (id: string, name: string) => string | null;
}

function getTM(): TerminalManager {
  return (global as Record<string, unknown>).terminalManager as TerminalManager;
}

function authCheck(request: NextRequest): boolean {
  const token = request.cookies.get("auth-token")?.value;
  return !!token && verifyToken(token);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!authCheck(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const deleted = getTM().deleteSession(id);

  if (deleted) {
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: "Session not found" }, { status: 404 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!authCheck(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { displayName } = await request.json();

  if (!displayName || typeof displayName !== "string") {
    return NextResponse.json({ error: "displayName required" }, { status: 400 });
  }

  const result = getTM().renameSession(id, displayName);
  if (result) {
    return NextResponse.json({ success: true, displayName: result });
  }
  return NextResponse.json({ error: "Session not found" }, { status: 404 });
}
