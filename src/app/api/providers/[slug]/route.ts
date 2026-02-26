import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getDb } from "@/lib/db";

function getUser(req: NextRequest) {
  const token = req.cookies.get("auth-token")?.value;
  return token ? verifyToken(token) : null;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role === "guest") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;
  const body = await request.json();
  const { name, command, resumeCommand, icon, color } = body;

  if (command && /[;|&$`\\]/.test(command)) {
    return NextResponse.json({ error: "Command contains forbidden characters" }, { status: 400 });
  }
  if (resumeCommand && /[;|&$`\\]/.test(resumeCommand)) {
    return NextResponse.json({ error: "Resume command contains forbidden characters" }, { status: 400 });
  }

  const db = getDb();
  const existing = db.prepare("SELECT * FROM cli_providers WHERE slug = ?").get(slug) as Record<string, unknown> | undefined;
  if (!existing) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (name !== undefined) { updates.push("name = ?"); values.push(name); }
  if (command !== undefined) { updates.push("command = ?"); values.push(command); }
  if (resumeCommand !== undefined) { updates.push("resume_command = ?"); values.push(resumeCommand || null); }
  if (icon !== undefined) { updates.push("icon = ?"); values.push(icon); }
  if (color !== undefined) { updates.push("color = ?"); values.push(color); }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  values.push(slug);
  db.prepare(`UPDATE cli_providers SET ${updates.join(", ")} WHERE slug = ?`).run(...values);

  const provider = db.prepare("SELECT * FROM cli_providers WHERE slug = ?").get(slug);
  return NextResponse.json({ provider });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role === "guest") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;
  const db = getDb();
  const provider = db.prepare("SELECT * FROM cli_providers WHERE slug = ?").get(slug) as { is_builtin: number } | undefined;

  if (!provider) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  if (provider.is_builtin) {
    return NextResponse.json({ error: "Cannot delete built-in provider" }, { status: 403 });
  }

  db.prepare("DELETE FROM cli_providers WHERE slug = ?").run(slug);
  return NextResponse.json({ success: true });
}
