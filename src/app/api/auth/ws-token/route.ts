import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import jwt from "jsonwebtoken";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Short-lived WS token carrying user identity
  const wsToken = jwt.sign(
    {
      purpose: "websocket",
      userId: payload.userId,
      login: payload.login,
      firstName: payload.firstName,
      lastName: payload.lastName,
      role: payload.role,
    },
    process.env.JWT_SECRET!,
    { expiresIn: "30s" }
  );

  return NextResponse.json({ token: wsToken });
}
