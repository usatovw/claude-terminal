import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import path from "path";
import fs from "fs";
import crypto from "crypto";

interface ChatManagerInterface {
  getMessages: (before: number | null, limit: number) => unknown[];
  sendMessage: (userId: number, text: string, attachments: Array<{
    filePath: string;
    originalName: string;
    mimeType: string;
    size: number;
  }>) => unknown;
}

function getChatManager(): ChatManagerInterface {
  return (global as Record<string, unknown>).chatManager as ChatManagerInterface;
}

const UPLOADS_DIR = path.join(process.cwd(), "chat-uploads");

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/zip",
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export async function GET(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const before = searchParams.get("before");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

  const cm = getChatManager();
  const messages = cm.getMessages(before ? parseInt(before, 10) : null, limit);

  return NextResponse.json({ messages });
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Guests cannot send messages
  if (payload.role === "guest") {
    return NextResponse.json(
      { error: "Гостям недоступна отправка сообщений" },
      { status: 403 }
    );
  }

  try {
    const contentType = request.headers.get("content-type") || "";

    let text = "";
    const attachments: Array<{
      filePath: string;
      originalName: string;
      mimeType: string;
      size: number;
    }> = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      text = (formData.get("text") as string) || "";

      // Ensure uploads dir exists
      if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      }

      const files = formData.getAll("files") as File[];
      for (const file of files) {
        if (!ALLOWED_MIME_TYPES.has(file.type)) {
          return NextResponse.json(
            { error: `Недопустимый тип файла: ${file.type}` },
            { status: 400 }
          );
        }
        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json(
            { error: `Файл слишком большой (макс. 50 МБ)` },
            { status: 400 }
          );
        }

        const ext = path.extname(file.name) || "";
        const uuid = crypto.randomUUID();
        const filename = `${uuid}${ext}`;
        const filePath = path.join(UPLOADS_DIR, filename);

        const buffer = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(filePath, buffer);

        attachments.push({
          filePath: filename,
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
        });
      }
    } else {
      const body = await request.json();
      text = body.text || "";
    }

    if (!text.trim() && attachments.length === 0) {
      return NextResponse.json(
        { error: "Сообщение не может быть пустым" },
        { status: 400 }
      );
    }

    const cm = getChatManager();
    const message = cm.sendMessage(payload.userId, text, attachments);

    return NextResponse.json({ message });
  } catch (err) {
    console.error("[chat/messages] Error:", err);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}
