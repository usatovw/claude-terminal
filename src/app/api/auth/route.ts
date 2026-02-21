import { NextRequest, NextResponse } from "next/server";
import { verifyUserPassword, createToken } from "@/lib/auth";
import type { DbUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

const loginAttempts = new Map<
  string,
  { count: number; lastAttempt: number }
>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";

  // Rate limiting
  const attempts = loginAttempts.get(ip);
  if (attempts && attempts.count >= MAX_ATTEMPTS) {
    const elapsed = Date.now() - attempts.lastAttempt;
    if (elapsed < WINDOW_MS) {
      return NextResponse.json(
        { error: "Слишком много попыток. Попробуйте позже." },
        { status: 429 }
      );
    }
    loginAttempts.delete(ip);
  }

  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json(
      { error: "Введите логин и пароль" },
      { status: 400 }
    );
  }

  const db = getDb();
  const user = db
    .prepare("SELECT * FROM users WHERE login = ?")
    .get(username.trim().toLowerCase()) as DbUser | undefined;

  if (!user || !(await verifyUserPassword(user, password))) {
    const current = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
    loginAttempts.set(ip, {
      count: current.count + 1,
      lastAttempt: Date.now(),
    });

    return NextResponse.json(
      { error: "Неверные учётные данные" },
      { status: 401 }
    );
  }

  // Check user status
  if (user.status === "pending") {
    return NextResponse.json(
      { error: "Ваша заявка ожидает подтверждения администратором" },
      { status: 403 }
    );
  }

  if (user.status === "rejected") {
    return NextResponse.json(
      { error: "Ваша заявка была отклонена" },
      { status: 403 }
    );
  }

  loginAttempts.delete(ip);

  const token = createToken({
    userId: user.id,
    login: user.login,
    firstName: user.first_name,
    lastName: user.last_name,
    role: user.role,
  });

  const response = NextResponse.json({ success: true });
  response.cookies.set("auth-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24,
    path: "/",
  });

  return response;
}
