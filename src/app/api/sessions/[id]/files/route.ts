import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { safePath, getSessionProjectDir } from "@/lib/files";
import fs from "fs/promises";
import path from "path";

function authCheck(request: NextRequest): boolean {
  const token = request.cookies.get("auth-token")?.value;
  return !!token && verifyToken(token);
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

  const relativePath = new URL(request.url).searchParams.get("path") || ".";
  const dirPath = safePath(projectDir, relativePath);
  if (!dirPath) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const stat = await fs.stat(dirPath);
    if (!stat.isDirectory()) {
      return NextResponse.json({ error: "Not a directory" }, { status: 400 });
    }

    const dirents = await fs.readdir(dirPath, { withFileTypes: true });
    const entries = await Promise.all(
      dirents
        .filter((d) => !d.name.startsWith("."))
        .map(async (d) => {
          const fullPath = path.join(dirPath, d.name);
          try {
            const st = await fs.stat(fullPath);
            return {
              name: d.name,
              type: d.isDirectory() ? "directory" : "file",
              size: d.isDirectory() ? 0 : st.size,
              modifiedAt: st.mtime.toISOString(),
              extension: d.isDirectory() ? null : path.extname(d.name).slice(1) || null,
            };
          } catch {
            return null;
          }
        })
    );

    return NextResponse.json({
      path: relativePath,
      entries: entries.filter(Boolean),
    });
  } catch {
    return NextResponse.json({ error: "Directory not found" }, { status: 404 });
  }
}
