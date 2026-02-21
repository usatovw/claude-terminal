import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { safePath, getSessionProjectDir } from "@/lib/files";
import fs from "fs/promises";

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
  const paths: string[] = body.paths;
  if (!Array.isArray(paths) || paths.length === 0) {
    return NextResponse.json({ error: "paths array required" }, { status: 400 });
  }

  const errors: string[] = [];

  for (const p of paths) {
    const abs = safePath(projectDir, p);
    if (!abs) {
      errors.push(`Invalid path: ${p}`);
      continue;
    }
    // Prevent deleting the project root itself
    if (abs === projectDir) {
      errors.push("Cannot delete project root");
      continue;
    }
    try {
      await fs.rm(abs, { recursive: true, force: true });
    } catch {
      errors.push(`Failed to delete: ${p}`);
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ success: false, errors }, { status: 207 });
  }

  return NextResponse.json({ success: true });
}
