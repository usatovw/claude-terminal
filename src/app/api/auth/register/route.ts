import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDb } from "@/lib/db";
import { sendRegistrationEmail } from "@/lib/email";
import type { DbUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { firstName, lastName, login, password } = await request.json();

    // Validate required fields
    if (!firstName || typeof firstName !== "string" || !firstName.trim()) {
      return NextResponse.json(
        { error: "Имя обязательно" },
        { status: 400 }
      );
    }
    if (!login || typeof login !== "string" || !login.trim()) {
      return NextResponse.json(
        { error: "Логин обязателен" },
        { status: 400 }
      );
    }
    if (!password || typeof password !== "string" || password.length < 4) {
      return NextResponse.json(
        { error: "Пароль должен быть не менее 4 символов" },
        { status: 400 }
      );
    }

    // Sanitize
    const cleanLogin = login.trim().toLowerCase();
    const cleanFirstName = firstName.trim();
    const cleanLastName = (lastName || "").trim();

    // Validate login format: only alphanumeric, dots, underscores, hyphens
    if (!/^[a-zA-Z0-9._-]+$/.test(cleanLogin)) {
      return NextResponse.json(
        { error: "Логин может содержать только латинские буквы, цифры, точки, дефисы и подчёркивания" },
        { status: 400 }
      );
    }

    const db = getDb();

    // Check uniqueness
    const existing = db.prepare("SELECT id FROM users WHERE login = ?").get(cleanLogin) as DbUser | undefined;
    if (existing) {
      return NextResponse.json(
        { error: "Этот логин уже занят" },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Assign next color_index via round-robin
    const maxColor = db.prepare("SELECT COALESCE(MAX(color_index), -1) as mc FROM users").get() as { mc: number };
    const colorIndex = (maxColor.mc + 1) % 12;

    // Insert user
    const result = db.prepare(
      `INSERT INTO users (login, password_hash, first_name, last_name, role, status, color_index)
       VALUES (?, ?, ?, ?, 'user', 'pending', ?)`
    ).run(cleanLogin, passwordHash, cleanFirstName, cleanLastName, colorIndex);

    const userId = result.lastInsertRowid as number;

    // Generate signed tokens for approve/reject (24h expiry)
    const JWT_SECRET = process.env.JWT_SECRET!;

    const approveToken = jwt.sign(
      { purpose: "registration_approval", userId, action: "approve" },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    const rejectToken = jwt.sign(
      { purpose: "registration_approval", userId, action: "reject" },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    // Send email to admin
    try {
      await sendRegistrationEmail(
        { first_name: cleanFirstName, last_name: cleanLastName, login: cleanLogin },
        approveToken,
        rejectToken
      );
    } catch (emailErr) {
      console.error("[register] Failed to send email:", emailErr);
      // Don't fail registration if email fails — admin can check DB
    }

    return NextResponse.json({
      success: true,
      message: "Заявка отправлена. Ожидайте подтверждения администратором.",
    });
  } catch (err) {
    console.error("[register] Error:", err);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}
