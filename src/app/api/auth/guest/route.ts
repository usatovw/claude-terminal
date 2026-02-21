import { NextRequest, NextResponse } from "next/server";
import { createToken } from "@/lib/auth";
import { generateName } from "@/lib/presence-names";

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    const expectedCode = process.env.GUEST_ACCESS_CODE;
    if (!expectedCode) {
      return NextResponse.json(
        { error: "Гостевой доступ не настроен" },
        { status: 503 }
      );
    }

    if (!code || code !== expectedCode) {
      return NextResponse.json(
        { error: "Неверный код доступа" },
        { status: 401 }
      );
    }

    // Generate random Russian name for guest
    const randomName = generateName();

    const token = createToken({
      userId: 0,
      login: "guest",
      firstName: randomName,
      lastName: "",
      role: "guest",
    });

    const response = NextResponse.json({
      success: true,
      user: { firstName: randomName, role: "guest" },
    });

    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 12, // 12 hours for guests
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}
