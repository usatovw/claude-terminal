import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { safePath, getSessionProjectDir } from "@/lib/files";
import fs from "fs/promises";
import path from "path";

function authCheck(request: NextRequest): boolean {
  const token = request.cookies.get("auth-token")?.value;
  return !!token && !!verifyToken(token);
}

const MAX_RESULTS = 100;
const MAX_DEPTH = 10;
const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "__pycache__", ".cache"]);

interface SearchEntry {
  name: string;
  relativePath: string;
  type: "file" | "directory";
  size: number;
  modifiedAt: string;
  extension: string | null;
}

async function recursiveSearch(
  baseDir: string,
  query: string,
  currentDir: string,
  depth: number,
  results: SearchEntry[]
): Promise<void> {
  if (depth > MAX_DEPTH || results.length >= MAX_RESULTS) return;

  let dirents;
  try {
    dirents = await fs.readdir(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  const q = query.toLowerCase();

  for (const d of dirents) {
    if (results.length >= MAX_RESULTS) break;
    if (d.name.startsWith(".")) continue;
    if (d.isDirectory() && SKIP_DIRS.has(d.name)) continue;

    const fullPath = path.join(currentDir, d.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (d.name.toLowerCase().includes(q)) {
      try {
        const st = await fs.stat(fullPath);
        results.push({
          name: d.name,
          relativePath,
          type: d.isDirectory() ? "directory" : "file",
          size: d.isDirectory() ? 0 : st.size,
          modifiedAt: st.mtime.toISOString(),
          extension: d.isDirectory() ? null : path.extname(d.name).slice(1) || null,
        });
      } catch {
        // skip inaccessible files
      }
    }

    if (d.isDirectory()) {
      await recursiveSearch(baseDir, query, fullPath, depth + 1, results);
    }
  }
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

  const searchParams = new URL(request.url).searchParams;
  const searchQuery = searchParams.get("search");

  // Recursive search mode
  if (searchQuery && searchQuery.trim()) {
    const results: SearchEntry[] = [];
    await recursiveSearch(projectDir, searchQuery.trim(), projectDir, 0, results);
    return NextResponse.json({ path: ".", search: searchQuery, entries: results });
  }

  // Normal directory listing
  const relativePath = searchParams.get("path") || ".";
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
