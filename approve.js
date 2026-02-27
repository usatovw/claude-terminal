#!/usr/bin/env node

/**
 * Claude Terminal — User Approval CLI
 *
 * Usage:
 *   node approve.js list                         — List pending users
 *   node approve.js approve <login>              — Approve a user
 *   node approve.js reject <login>               — Reject a user
 *   node approve.js create-admin <login> <pass>  — Create admin user
 *
 * Works directly with SQLite, no running server needed.
 */

const path = require("path");
const fs = require("fs");

// Load .env.local for JWT_SECRET (needed by db.js seedAdmin)
const envPath = path.join(__dirname, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    const val = trimmed.slice(eqIdx + 1);
    if (!process.env[key]) process.env[key] = val;
  }
}

const db = require("./db");

function bold(t) { return `\x1b[1m${t}\x1b[0m`; }
function green(t) { return `\x1b[32m${t}\x1b[0m`; }
function yellow(t) { return `\x1b[33m${t}\x1b[0m`; }
function red(t) { return `\x1b[31m${t}\x1b[0m`; }
function dim(t) { return `\x1b[2m${t}\x1b[0m`; }

const args = process.argv.slice(2);
const command = args[0];

function printUsage() {
  console.log("");
  console.log(bold("  Claude Terminal — User Approval CLI"));
  console.log("");
  console.log("  Usage:");
  console.log(`    node approve.js ${green("list")}                         — List all users`);
  console.log(`    node approve.js ${green("approve")} <login>              — Approve a pending user`);
  console.log(`    node approve.js ${green("reject")} <login>               — Reject a pending user`);
  console.log(`    node approve.js ${green("create-admin")} <login> <pass>  — Create admin user`);
  console.log("");
}

function statusBadge(status) {
  switch (status) {
    case "approved": return green("approved");
    case "pending": return yellow("pending");
    case "rejected": return red("rejected");
    default: return status;
  }
}

function roleBadge(role) {
  switch (role) {
    case "admin": return bold(role);
    case "user": return role;
    case "guest": return dim(role);
    default: return role;
  }
}

async function main() {
  switch (command) {
    case "list": {
      const users = db.prepare(
        "SELECT id, login, first_name, last_name, role, status, created_at FROM users ORDER BY created_at DESC"
      ).all();

      if (users.length === 0) {
        console.log("  No users in database.");
        return;
      }

      console.log("");
      console.log(bold("  Users:"));
      console.log("");

      for (const u of users) {
        const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
        console.log(`    ${dim(`#${u.id}`)} ${bold(u.login)} (${name}) — ${roleBadge(u.role)} / ${statusBadge(u.status)} — ${dim(u.created_at)}`);
      }

      const pendingCount = users.filter(u => u.status === "pending").length;
      if (pendingCount > 0) {
        console.log("");
        console.log(`  ${yellow(`${pendingCount} pending`)} — run: node approve.js approve <login>`);
      }
      console.log("");
      break;
    }

    case "approve": {
      const login = args[1];
      if (!login) {
        console.log(red("  Error: login required. Usage: node approve.js approve <login>"));
        process.exit(1);
      }

      const user = db.prepare("SELECT * FROM users WHERE login = ?").get(login.toLowerCase());
      if (!user) {
        console.log(red(`  User "${login}" not found.`));
        process.exit(1);
      }

      if (user.status === "approved") {
        console.log(yellow(`  User "${login}" is already approved.`));
        return;
      }

      db.prepare("UPDATE users SET status = 'approved' WHERE id = ?").run(user.id);
      console.log(green(`  User "${login}" approved.`));
      break;
    }

    case "reject": {
      const login = args[1];
      if (!login) {
        console.log(red("  Error: login required. Usage: node approve.js reject <login>"));
        process.exit(1);
      }

      const user = db.prepare("SELECT * FROM users WHERE login = ?").get(login.toLowerCase());
      if (!user) {
        console.log(red(`  User "${login}" not found.`));
        process.exit(1);
      }

      db.prepare("UPDATE users SET status = 'rejected' WHERE id = ?").run(user.id);
      console.log(green(`  User "${login}" rejected.`));
      break;
    }

    case "create-admin": {
      const login = args[1];
      const password = args[2];
      if (!login || !password) {
        console.log(red("  Error: Usage: node approve.js create-admin <login> <password>"));
        process.exit(1);
      }

      if (password.length < 4) {
        console.log(red("  Error: Password must be at least 4 characters."));
        process.exit(1);
      }

      const bcrypt = require("bcryptjs");
      const hash = await bcrypt.hash(password, 10);

      const existing = db.prepare("SELECT id FROM users WHERE login = ?").get(login.toLowerCase());
      if (existing) {
        db.prepare(
          "UPDATE users SET password_hash = ?, role = 'admin', status = 'approved' WHERE login = ?"
        ).run(hash, login.toLowerCase());
        console.log(green(`  Existing user "${login}" updated to admin.`));
      } else {
        const maxColor = db.prepare("SELECT COALESCE(MAX(color_index), -1) as mc FROM users").get();
        const colorIndex = (maxColor.mc + 1) % 12;
        db.prepare(
          `INSERT INTO users (login, password_hash, first_name, last_name, role, status, color_index)
           VALUES (?, ?, ?, '', 'admin', 'approved', ?)`
        ).run(login.toLowerCase(), hash, "Admin", colorIndex);
        console.log(green(`  Admin user "${login}" created.`));
      }
      break;
    }

    default:
      printUsage();
      break;
  }
}

main().catch((err) => {
  console.error(red("  Error:"), err.message);
  process.exit(1);
});
