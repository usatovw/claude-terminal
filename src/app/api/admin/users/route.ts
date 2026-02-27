import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import type { DbUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

function getTokenPayload(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request: NextRequest) {
  const payload = getTokenPayload(request);
  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getDb();
  const users = db.prepare(
    `SELECT id, login, first_name, last_name, role, status, color_index, created_at
     FROM users ORDER BY created_at DESC`
  ).all() as DbUser[];

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      login: u.login,
      firstName: u.first_name,
      lastName: u.last_name,
      role: u.role,
      status: u.status,
      colorIndex: u.color_index,
      createdAt: u.created_at,
    })),
  });
}

export async function PATCH(request: NextRequest) {
  const payload = getTokenPayload(request);
  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId, action, role } = await request.json();

  if (!userId || !action) {
    return NextResponse.json({ error: "userId and action required" }, { status: 400 });
  }

  const db = getDb();
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as DbUser | undefined;
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Cannot modify yourself
  if (user.id === payload.userId) {
    return NextResponse.json({ error: "Нельзя изменить свой аккаунт" }, { status: 400 });
  }

  switch (action) {
    case "approve":
      db.prepare("UPDATE users SET status = 'approved' WHERE id = ?").run(userId);
      return NextResponse.json({ success: true });

    case "reject":
      db.prepare("UPDATE users SET status = 'rejected' WHERE id = ?").run(userId);
      return NextResponse.json({ success: true });

    case "set_role": {
      if (!role || !["admin", "user"].includes(role)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }

      // Cannot remove last admin
      if (user.role === "admin" && role !== "admin") {
        const adminCount = db.prepare(
          "SELECT COUNT(*) as c FROM users WHERE role = 'admin' AND status = 'approved'"
        ).get() as { c: number };
        if (adminCount.c <= 1) {
          return NextResponse.json({ error: "Нельзя убрать последнего администратора" }, { status: 400 });
        }
      }

      db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, userId);
      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
