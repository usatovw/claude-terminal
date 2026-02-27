import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import type { DbUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

function getTokenPayload(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = getTokenPayload(request);
  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const userId = parseInt(id, 10);
  if (isNaN(userId)) {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  const db = getDb();
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as DbUser | undefined;
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Cannot delete yourself
  if (user.id === payload.userId) {
    return NextResponse.json({ error: "Нельзя удалить свой аккаунт" }, { status: 400 });
  }

  // Cannot delete last admin
  if (user.role === "admin") {
    const adminCount = db.prepare(
      "SELECT COUNT(*) as c FROM users WHERE role = 'admin' AND status = 'approved'"
    ).get() as { c: number };
    if (adminCount.c <= 1) {
      return NextResponse.json({ error: "Нельзя удалить последнего администратора" }, { status: 400 });
    }
  }

  db.prepare("DELETE FROM users WHERE id = ?").run(userId);

  return NextResponse.json({ success: true });
}
