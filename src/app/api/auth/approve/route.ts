import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getDb } from "@/lib/db";
import type { DbUser } from "@/lib/auth";

interface ApprovalPayload {
  purpose: string;
  userId: number;
  action: "approve" | "reject";
}

function htmlResponse(title: string, message: string, success: boolean): NextResponse {
  const color = success ? "#22c55e" : "#ef4444";
  const html = `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="text-align:center;padding:40px;max-width:400px;">
    <div style="width:64px;height:64px;margin:0 auto 24px;border-radius:50%;background:${color}20;display:flex;align-items:center;justify-content:center;">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        ${success ? '<path d="M20 6 9 17l-5-5"/>' : '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'}
      </svg>
    </div>
    <h1 style="color:#fff;font-size:24px;margin:0 0 8px;">${title}</h1>
    <p style="color:#a1a1aa;font-size:16px;margin:0;">${message}</p>
  </div>
</body>
</html>`;
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const action = searchParams.get("action");

  if (!token) {
    return htmlResponse("Ошибка", "Отсутствует токен", false);
  }

  // Verify JWT
  let payload: ApprovalPayload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET!) as ApprovalPayload;
  } catch {
    return htmlResponse("Ссылка недействительна", "Токен истёк или невалиден. Время действия ссылки — 24 часа.", false);
  }

  if (payload.purpose !== "registration_approval") {
    return htmlResponse("Ошибка", "Невалидный токен", false);
  }

  const db = getDb();
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(payload.userId) as DbUser | undefined;

  if (!user) {
    return htmlResponse("Ошибка", "Пользователь не найден", false);
  }

  if (user.status !== "pending") {
    const statusText = user.status === "approved" ? "уже одобрен" : "уже отклонён";
    return htmlResponse("Уже обработано", `Пользователь ${user.first_name} ${statusText}.`, false);
  }

  // Determine action from query param (fallback to token payload)
  const effectiveAction = action === "approve" || action === "reject" ? action : payload.action;
  const newStatus = effectiveAction === "approve" ? "approved" : "rejected";

  db.prepare("UPDATE users SET status = ? WHERE id = ?").run(newStatus, payload.userId);

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");

  if (newStatus === "approved") {
    return htmlResponse("Одобрено", `Пользователь ${fullName} (@${user.login}) одобрён и может войти в систему.`, true);
  } else {
    return htmlResponse("Отклонено", `Заявка пользователя ${fullName} (@${user.login}) отклонена.`, false);
  }
}
