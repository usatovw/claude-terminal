import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { safePath, getSessionProjectDir } from "@/lib/files";
import fs from "fs/promises";

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB

function authCheck(request: NextRequest): boolean {
  const token = request.cookies.get("auth-token")?.value;
  return !!token && !!verifyToken(token);
}

export async function GET(
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

  const relativePath = new URL(request.url).searchParams.get("path");
  if (!relativePath) {
    return NextResponse.json({ error: "path required" }, { status: 400 });
  }

  const filePath = safePath(projectDir, relativePath);
  if (!filePath) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return NextResponse.json({ error: "Not a file" }, { status: 400 });
    }

    if (stat.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large", size: stat.size, limit: MAX_FILE_SIZE },
        { status: 413 }
      );
    }

    const content = await fs.readFile(filePath, "utf-8");
    return NextResponse.json({ content, size: stat.size });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
