import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { safePath, getSessionProjectDir } from "@/lib/files";
import fs from "fs/promises";
import path from "path";

function authCheck(request: NextRequest): boolean {
  const token = request.cookies.get("auth-token")?.value;
  return !!token && !!verifyToken(token);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!authCheck(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  // newName must be a plain filename — no slashes, backslashes, or ..
  if (/[/\\]/.test(newName) || newName.includes("..") || !newName.trim()) {
    return NextResponse.json({ error: "Invalid new name" }, { status: 400 });
  }

  const absOld = safePath(projectDir, oldPath);
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
