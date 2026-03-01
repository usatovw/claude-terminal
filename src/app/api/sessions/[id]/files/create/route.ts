import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { safeRealPath, getSessionProjectDir, isValidFilePath } from "@/lib/files";
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
    return NextResponse.json({ error: "Гости не могут создавать файлы" }, { status: 403 });
  }

  const { id } = await params;
  const projectDir = getSessionProjectDir(id);
  if (!projectDir) {
    return NextResponse.json({ error: "Сессия не найдена" }, { status: 404 });
  }

  let body: { name?: string; directory?: string; type?: "file" | "folder" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const { name, directory = ".", type = "file" } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Укажите имя" }, { status: 400 });
  }

  const trimmedName = name.trim();

  if (!isValidFilePath(trimmedName)) {
    return NextResponse.json({ error: "Недопустимое имя файла" }, { status: 400 });
  }

  const dirPath = await safeRealPath(projectDir, directory);
  if (!dirPath) {
    return NextResponse.json({ error: "Недопустимая директория" }, { status: 400 });
  }

  const targetPath = path.join(dirPath, trimmedName);
  // Verify target stays within projectDir
  if (!targetPath.startsWith(projectDir + path.sep) && targetPath !== projectDir) {
    return NextResponse.json({ error: "Недопустимый путь" }, { status: 400 });
  }

  try {
    // Create intermediate directories if path contains slashes
    const parentDir = path.dirname(targetPath);
    if (parentDir !== dirPath) {
      await fs.mkdir(parentDir, { recursive: true });
      // TOCTOU protection: verify the created parent is still inside projectDir
      const realParent = await fs.realpath(parentDir);
      if (!realParent.startsWith(projectDir + path.sep) && realParent !== projectDir) {
        return NextResponse.json({ error: "Недопустимый путь" }, { status: 400 });
      }
    }

    if (type === "folder") {
      // Check if folder already exists before creating
      try {
        await fs.access(targetPath);
        return NextResponse.json({ error: "Уже существует" }, { status: 409 });
      } catch {
        // Does not exist — proceed
      }
      await fs.mkdir(targetPath, { recursive: true });
    } else {
      // TOCTOU-safe: fs.open with 'wx' flag fails if file exists
      const fh = await fs.open(targetPath, "wx");
      await fh.close();
    }
    return NextResponse.json({ ok: true, path: path.relative(projectDir, targetPath) });
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e) {
      if (e.code === "EEXIST") {
        return NextResponse.json({ error: "Уже существует" }, { status: 409 });
      }
      if (e.code === "ENOSPC") {
        return NextResponse.json({ error: "Нет места на диске" }, { status: 507 });
      }
    }
    return NextResponse.json({ error: "Ошибка создания" }, { status: 500 });
  }
}
