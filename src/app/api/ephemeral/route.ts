import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

function getUser(req: NextRequest) {
  const token = req.cookies.get("auth-token")?.value;
  return token ? verifyToken(token) : null;
}

function getTerminalManager() {
  return (global as Record<string, unknown>).terminalManager as {
    createEphemeralSession: () => string;
    destroyEphemeralSession: (id: string) => boolean;
  };
}

export async function POST(request: NextRequest) {
  const user = getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role === "guest") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const tm = getTerminalManager();
    const sessionId = tm.createEphemeralSession();
    return NextResponse.json({ sessionId });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 429 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const user = getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role === "guest") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { sessionId } = await request.json();
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const tm = getTerminalManager();
  const destroyed = tm.destroyEphemeralSession(sessionId);
  if (destroyed) return NextResponse.json({ success: true });
  return NextResponse.json({ error: "Session not found" }, { status: 404 });
}
