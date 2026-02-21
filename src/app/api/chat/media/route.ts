import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

interface ChatManagerInterface {
  getMedia: (type: string | null, offset: number, limit: number) => unknown[];
}

function getChatManager(): ChatManagerInterface {
  return (global as Record<string, unknown>).chatManager as ChatManagerInterface;
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value;
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // "images" | "files" | null
  const offset = parseInt(searchParams.get("offset") || "0", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

  const cm = getChatManager();
  const media = cm.getMedia(type, offset, limit);

  return NextResponse.json({ media });
}
