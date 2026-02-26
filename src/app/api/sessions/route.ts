import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

function getTerminalManager() {
  return (global as Record<string, unknown>).terminalManager as {
    listSessions: () => unknown[];
    createSession: (providerSlug?: string) => { sessionId: string; projectDir: string };
  };
}

function getUser(req: NextRequest) {
  const token = req.cookies.get("auth-token")?.value;
  return token ? verifyToken(token) : null;
}

export async function GET(request: NextRequest) {
  const user = getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tm = getTerminalManager();
  return NextResponse.json({ sessions: tm.listSessions() });
}

export async function POST(request: NextRequest) {
  const user = getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role === "guest") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let providerSlug = "claude";
  try {
    const body = await request.json();
    if (body.providerSlug) providerSlug = body.providerSlug;
  } catch {
    // No body or invalid JSON — use default
  }

  try {
    const tm = getTerminalManager();
    const { sessionId, projectDir } = tm.createSession(providerSlug);
    return NextResponse.json({ sessionId, projectDir });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    );
  }
}
