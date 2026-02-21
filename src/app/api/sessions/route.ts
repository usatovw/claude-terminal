import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

function getTerminalManager() {
  return (global as Record<string, unknown>).terminalManager as {
    listSessions: () => unknown[];
    createSession: () => { sessionId: string; projectDir: string };
  };
}

function authCheck(request: NextRequest): boolean {
  const token = request.cookies.get("auth-token")?.value;
  return !!token && !!verifyToken(token);
}

export async function GET(request: NextRequest) {
  if (!authCheck(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tm = getTerminalManager();
  return NextResponse.json({ sessions: tm.listSessions() });
}

export async function POST(request: NextRequest) {
  if (!authCheck(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tm = getTerminalManager();
  const { sessionId, projectDir } = tm.createSession();
  return NextResponse.json({ sessionId, projectDir });
}
