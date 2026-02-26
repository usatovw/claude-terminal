import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getDb } from "@/lib/db";

function getUser(req: NextRequest) {
  const token = req.cookies.get("auth-token")?.value;
  return token ? verifyToken(token) : null;
}

export async function GET(request: NextRequest) {
  const user = getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const providers = db.prepare("SELECT * FROM cli_providers ORDER BY sort_order, name").all();
  return NextResponse.json({ providers });
}

const SLUG_RE = /^[a-z0-9-]+$/;

export async function POST(request: NextRequest) {
  const user = getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role === "guest") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { name, slug, command, resumeCommand, icon, color } = body;

  if (!name || !slug || !command) {
    return NextResponse.json({ error: "name, slug, command required" }, { status: 400 });
  }

  if (!SLUG_RE.test(slug) || slug.length > 30) {
    return NextResponse.json({ error: "Invalid slug (a-z0-9-, max 30 chars)" }, { status: 400 });
  }

  // Validate no shell metacharacters in command
  if (/[;|&$`\\]/.test(command) || (resumeCommand && /[;|&$`\\]/.test(resumeCommand))) {
    return NextResponse.json({ error: "Command contains forbidden characters" }, { status: 400 });
  }

  const db = getDb();

  const existing = db.prepare("SELECT id FROM cli_providers WHERE slug = ?").get(slug);
  if (existing) {
    return NextResponse.json({ error: "Provider with this slug already exists" }, { status: 409 });
  }

  const maxOrder = db.prepare("SELECT MAX(sort_order) as m FROM cli_providers").get() as { m: number | null };
  const sortOrder = (maxOrder?.m || 100) + 1;

  db.prepare(
    `INSERT INTO cli_providers (name, slug, command, resume_command, icon, color, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(name, slug, command, resumeCommand || null, icon || "default", color || "#8b5cf6", sortOrder);

  const provider = db.prepare("SELECT * FROM cli_providers WHERE slug = ?").get(slug);
  return NextResponse.json({ provider }, { status: 201 });
}
