import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, createToken } from "@/lib/auth";

const loginAttempts = new Map<
  string,
  { count: number; lastAttempt: number }
>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";

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

  const expectedUsername = process.env.LOGIN_USERNAME || "admin";
  if (
    username !== expectedUsername ||
    !(await verifyPassword(password))
  ) {
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

  loginAttempts.delete(ip);
  const token = createToken();

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
