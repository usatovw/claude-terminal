import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { safePath, getSessionProjectDir } from "@/lib/files";
import fs from "fs/promises";
import path from "path";

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

    const buffer = await fs.readFile(filePath);
    const filename = path.basename(filePath);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
