import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { safePath, getSessionProjectDir } from "@/lib/files";
import fs from "fs";
import path from "path";
import archiver from "archiver";

function authCheck(request: NextRequest): boolean {
  const token = request.cookies.get("auth-token")?.value;
  return !!token && verifyToken(token);
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

  // Validate all paths first
  const resolvedPaths: { abs: string; name: string }[] = [];
  for (const p of paths) {
    const abs = safePath(projectDir, p);
    if (!abs) {
      return NextResponse.json({ error: `Invalid path: ${p}` }, { status: 400 });
    }
    if (!fs.existsSync(abs)) {
      return NextResponse.json({ error: `Not found: ${p}` }, { status: 404 });
    }
    resolvedPaths.push({ abs, name: path.basename(p) });
  }

  // Create zip stream
  const archive = archiver("zip", { zlib: { level: 5 } });
  const chunks: Buffer[] = [];

  return new Promise<NextResponse>((resolve) => {
    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("end", () => {
      const buffer = Buffer.concat(chunks);
      resolve(
        new NextResponse(buffer, {
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": 'attachment; filename="files.zip"',
            "Content-Length": String(buffer.length),
          },
        })
      );
    });
    archive.on("error", () => {
      resolve(NextResponse.json({ error: "Zip creation failed" }, { status: 500 }));
    });

    for (const { abs, name } of resolvedPaths) {
      const stat = fs.statSync(abs);
      if (stat.isDirectory()) {
        archive.directory(abs, name);
      } else {
        archive.file(abs, { name });
      }
    }

    archive.finalize();
  });
}
