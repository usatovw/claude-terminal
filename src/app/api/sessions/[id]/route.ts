import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

interface TerminalManager {
  stopSession: (id: string) => boolean;
  deleteSession: (id: string) => boolean;
  renameSession: (id: string, name: string) => string | null;
  resumeSession: (id: string) => { ok: boolean; error?: string };
}

function getTM(): TerminalManager {
  return (global as Record<string, unknown>).terminalManager as TerminalManager;
}

function authCheck(request: NextRequest): boolean {
  const token = request.cookies.get("auth-token")?.value;
  return !!token && verifyToken(token);
}

// Stop and delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!authCheck(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { action } = Object.fromEntries(new URL(request.url).searchParams);

  if (action === "stop") {
    const stopped = getTM().stopSession(id);
    if (stopped) return NextResponse.json({ success: true });
    return NextResponse.json({ error: "Session not found or already stopped" }, { status: 404 });
  }

  const deleted = getTM().deleteSession(id);
  if (deleted) return NextResponse.json({ success: true });
  return NextResponse.json({ error: "Session not found" }, { status: 404 });
}

// Resume
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!authCheck(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const result = getTM().resumeSession(id);

  if (result.ok) return NextResponse.json({ success: true });

  const status = result.error === "not_found" ? 404 : 400;
  return NextResponse.json({ error: result.error }, { status });
}

// Rename
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
  if (result) return NextResponse.json({ success: true, displayName: result });
  return NextResponse.json({ error: "Session not found" }, { status: 404 });
}
