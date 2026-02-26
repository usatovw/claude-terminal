import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

function getUser(req: NextRequest) {
  const token = req.cookies.get("auth-token")?.value;
  return token ? verifyToken(token) : null;
}

const PRESETS = [
  { name: "Codex", slug: "codex", command: "codex", resumeCommand: null, icon: "codex", color: "#10b981" },
  { name: "Gemini CLI", slug: "gemini", command: "gemini", resumeCommand: null, icon: "gemini", color: "#4285f4" },
  { name: "Aider", slug: "aider", command: "aider", resumeCommand: null, icon: "aider", color: "#f59e0b" },
  { name: "Amazon Q", slug: "amazonq", command: "q chat", resumeCommand: null, icon: "amazonq", color: "#ff9900" },
];

export async function GET(request: NextRequest) {
  const user = getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ presets: PRESETS });
}
