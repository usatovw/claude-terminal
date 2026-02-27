import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { safePath, getSessionProjectDir } from "@/lib/files";
import fs from "fs/promises";

function getRole(request: NextRequest): string | null {
  const token = request.cookies.get("auth-token")?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  return (payload as { role?: string }).role ?? null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = getRole(request);
  if (!role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (role === "guest") {
    return NextResponse.json({ error: "Guests cannot edit files" }, { status: 403 });
  }

  const { id } = await params;
  const projectDir = getSessionProjectDir(id);
  if (!projectDir) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  let body: { path?: string; content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { path: relativePath, content } = body;
  if (!relativePath || typeof content !== "string") {
    return NextResponse.json({ error: "path and content required" }, { status: 400 });
  }

  const filePath = safePath(projectDir, relativePath);
  if (!filePath) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    await fs.writeFile(filePath, content, "utf-8");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to write file" }, { status: 500 });
  }
}
