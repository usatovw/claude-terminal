import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import jwt from "jsonwebtoken";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value;
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const wsToken = jwt.sign(
    { purpose: "websocket" },
    process.env.JWT_SECRET!,
    { expiresIn: "30s" }
  );

  return NextResponse.json({ token: wsToken });
}
