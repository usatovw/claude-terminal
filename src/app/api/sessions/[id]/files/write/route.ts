import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { safeRealPath, getSessionProjectDir } from "@/lib/files";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

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

  let body: { path?: string; content?: string; expectedMtime?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { path: relativePath, content, expectedMtime } = body;
  if (!relativePath || typeof content !== "string") {
    return NextResponse.json({ error: "path and content required" }, { status: 400 });
  }

  const filePath = await safeRealPath(projectDir, relativePath);
  if (!filePath) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    // Optimistic concurrency: check mtime if expectedMtime provided
    if (typeof expectedMtime === "number") {
      try {
        const stat = await fs.stat(filePath);
        if (Math.abs(stat.mtimeMs - expectedMtime) > 1) {
          return NextResponse.json(
            { error: "File was modified externally", conflict: true, currentMtime: stat.mtimeMs },
            { status: 409 }
          );
        }
      } catch {
        // File doesn't exist yet — that's OK for new files
      }
    }

    // Atomic write: write to temp file, then rename
    const dir = path.dirname(filePath);
    const tmpName = `.tmp.${crypto.randomUUID()}`;
    const tmpPath = path.join(dir, tmpName);

    await fs.writeFile(tmpPath, content, "utf-8");
    await fs.rename(tmpPath, filePath);

    // Return new mtime
    const newStat = await fs.stat(filePath);
    return NextResponse.json({ ok: true, mtime: newStat.mtimeMs });
  } catch (e: unknown) {
    // ENOSPC handling
    if (e && typeof e === "object" && "code" in e && e.code === "ENOSPC") {
      return NextResponse.json({ error: "No space left on device" }, { status: 507 });
    }
    return NextResponse.json({ error: "Failed to write file" }, { status: 500 });
  }
}
