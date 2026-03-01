import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { safeRealPath, getSessionProjectDir, isValidFilename } from "@/lib/files";
import fs from "fs/promises";
import path from "path";

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
    return NextResponse.json({ error: "Guests cannot rename files" }, { status: 403 });
  }

  const { id } = await params;
  const projectDir = getSessionProjectDir(id);
  if (!projectDir) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const body = await request.json();
  const { oldPath, newName } = body;

  if (!oldPath || !newName || typeof oldPath !== "string" || typeof newName !== "string") {
    return NextResponse.json({ error: "oldPath and newName required" }, { status: 400 });
  }

  if (!isValidFilename(newName.trim())) {
    return NextResponse.json({ error: "Invalid new name" }, { status: 400 });
  }

  const absOld = await safeRealPath(projectDir, oldPath);
  if (!absOld || absOld === projectDir) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const absNew = path.join(path.dirname(absOld), newName.trim());
  // Verify new path also stays within projectDir
  if (!absNew.startsWith(projectDir + path.sep) && absNew !== projectDir) {
    return NextResponse.json({ error: "Invalid new name" }, { status: 400 });
  }

  try {
    await fs.access(absOld);
    await fs.rename(absOld, absNew);
    return NextResponse.json({ success: true, newName: newName.trim() });
  } catch {
    return NextResponse.json({ error: "Rename failed" }, { status: 404 });
  }
}
