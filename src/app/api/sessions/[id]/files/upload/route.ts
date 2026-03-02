import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { safeRealPath, getSessionProjectDir, isValidFilename, isValidFilePath } from "@/lib/files";
import fs from "fs/promises";
import path from "path";

function getRole(request: NextRequest): string | null {
  const token = request.cookies.get("auth-token")?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  return (payload as { role?: string }).role ?? null;
}

// Rate limiting
const uploadAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 30;
const WINDOW_MS = 5 * 60 * 1000;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_FILES = 100;

const DANGEROUS_EXTENSIONS = new Set([
  ".exe", ".bat", ".cmd", ".sh", ".ps1", ".msi", ".dll", ".so",
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = getRole(request);
  if (!role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (role === "guest") {
    return NextResponse.json({ error: "Гости не могут загружать файлы" }, { status: 403 });
  }

  // Rate limiting
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const attempts = uploadAttempts.get(ip);
  if (attempts && attempts.count >= MAX_ATTEMPTS) {
    const elapsed = Date.now() - attempts.lastAttempt;
    if (elapsed < WINDOW_MS) {
      return NextResponse.json(
        { error: "Слишком много запросов. Попробуйте позже." },
        { status: 429 }
      );
    }
    uploadAttempts.delete(ip);
  }

  const current = uploadAttempts.get(ip) || { count: 0, lastAttempt: 0 };
  uploadAttempts.set(ip, {
    count: current.count + 1,
    lastAttempt: Date.now(),
  });

  const { id } = await params;
  const projectDir = getSessionProjectDir(id);
  if (!projectDir) {
    return NextResponse.json({ error: "Сессия не найдена" }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const directory = (formData.get("directory") as string) || ".";
  const files = formData.getAll("file") as File[];
  const relativePaths = formData.getAll("relativePath") as string[];

  if (files.length === 0) {
    return NextResponse.json({ error: "Файлы не выбраны" }, { status: 400 });
  }

  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Максимум ${MAX_FILES} файлов за раз` },
      { status: 400 }
    );
  }

  const dirPath = await safeRealPath(projectDir, directory);
  if (!dirPath) {
    return NextResponse.json({ error: "Недопустимая директория" }, { status: 400 });
  }

  const uploaded: string[] = [];
  const errors: { name: string; error: string }[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const relPath = relativePaths[i] || file.name;
    const displayName = relPath || file.name;

    // Validate path: if it contains slashes, validate as file path; otherwise as filename
    if (relPath.includes("/")) {
      if (!isValidFilePath(relPath)) {
        errors.push({ name: displayName, error: "Недопустимый путь файла" });
        continue;
      }
    } else {
      if (!isValidFilename(relPath)) {
        errors.push({ name: displayName, error: "Недопустимое имя файла" });
        continue;
      }
    }

    // Check dangerous extensions
    const ext = path.extname(relPath).toLowerCase();
    if (DANGEROUS_EXTENSIONS.has(ext)) {
      errors.push({ name: displayName, error: `Расширение ${ext} запрещено. Используйте терминал.` });
      continue;
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      errors.push({ name: displayName, error: "Файл превышает 50 МБ" });
      continue;
    }

    const targetPath = path.join(dirPath, relPath);
    // Verify target stays within projectDir
    if (!targetPath.startsWith(projectDir + path.sep) && targetPath !== projectDir) {
      errors.push({ name: displayName, error: "Недопустимый путь" });
      continue;
    }

    try {
      // Create intermediate directories if needed
      const parentDir = path.dirname(targetPath);
      await fs.mkdir(parentDir, { recursive: true });

      // TOCTOU protection: verify the parent is still inside projectDir
      const realParent = await fs.realpath(parentDir);
      if (!realParent.startsWith(projectDir + path.sep) && realParent !== projectDir) {
        errors.push({ name: displayName, error: "Недопустимый путь" });
        continue;
      }

      const fileName = path.basename(targetPath);
      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(path.join(realParent, fileName), buffer);
      uploaded.push(displayName);
    } catch (e: unknown) {
      if (e && typeof e === "object" && "code" in e && e.code === "ENOSPC") {
        errors.push({ name: displayName, error: "Нет места на диске" });
      } else {
        errors.push({ name: displayName, error: "Ошибка записи" });
      }
    }
  }

  if (uploaded.length === 0 && errors.length > 0) {
    return NextResponse.json({ ok: false, uploaded, errors }, { status: 400 });
  }

  if (errors.length > 0) {
    return NextResponse.json({ ok: true, uploaded, errors }, { status: 207 });
  }

  return NextResponse.json({ ok: true, uploaded, errors: [] });
}
