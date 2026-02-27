#!/usr/bin/env node

/**
 * Claude Terminal — Interactive Setup Wizard
 *
 * Usage: node setup.js
 *
 * Creates .env.local, seeds admin user in SQLite database.
 * Uses only built-in Node.js modules + bcryptjs (already in deps).
 */

const readline = require("readline");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const net = require("net");
const { execSync } = require("child_process");

// ── Helpers ──

function bold(text) { return `\x1b[1m${text}\x1b[0m`; }
function green(text) { return `\x1b[32m${text}\x1b[0m`; }
function yellow(text) { return `\x1b[33m${text}\x1b[0m`; }
function red(text) { return `\x1b[31m${text}\x1b[0m`; }
function dim(text) { return `\x1b[2m${text}\x1b[0m`; }
function cyan(text) { return `\x1b[36m${text}\x1b[0m`; }

function ok(msg) { console.log(`  ${green("OK")} ${msg}`); }
function warn(msg) { console.log(`  ${yellow("!!")} ${msg}`); }
function fail(msg) { console.log(`  ${red("FAIL")} ${msg}`); }

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question, defaultValue = "") {
  const suffix = defaultValue ? ` ${dim(`[${defaultValue}]`)}` : "";
  return new Promise((resolve) => {
    rl.question(`  ${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

function askYN(question, defaultYes = false) {
  const hint = defaultYes ? "[Y/n]" : "[y/N]";
  return new Promise((resolve) => {
    rl.question(`  ${question} ${dim(hint)} `, (answer) => {
      const a = answer.trim().toLowerCase();
      if (!a) return resolve(defaultYes);
      resolve(a === "y" || a === "yes");
    });
  });
}

function askPassword(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(`  ${prompt}: `);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf-8");

    let password = "";
    const onData = (ch) => {
      const c = ch.toString();
      if (c === "\n" || c === "\r" || c === "\u0004") {
        stdin.setRawMode(wasRaw || false);
        stdin.removeListener("data", onData);
        stdin.pause();
        process.stdout.write("\n");
        resolve(password);
      } else if (c === "\u0003") {
        // Ctrl+C
        process.stdout.write("\n");
        process.exit(1);
      } else if (c === "\u007f" || c === "\b") {
        // Backspace
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write("\b \b");
        }
      } else {
        password += c;
        process.stdout.write("*");
      }
    };
    stdin.on("data", onData);
  });
}

function askChoice(question, options) {
  console.log(`  ${question}`);
  options.forEach((opt, i) => {
    console.log(`    ${dim(`[${i + 1}]`)} ${opt}`);
  });
  return new Promise((resolve) => {
    rl.question(`  ${dim(">")} `, (answer) => {
      const idx = parseInt(answer.trim(), 10) - 1;
      if (idx >= 0 && idx < options.length) {
        resolve(idx);
      } else {
        resolve(0); // default to first
      }
    });
  });
}

function which(cmd) {
  try {
    return execSync(`which ${cmd}`, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const conn = net.createConnection({ port, host: "127.0.0.1" });
    conn.on("connect", () => { conn.destroy(); resolve(false); });
    conn.on("error", () => { resolve(true); });
  });
}

// ── Main ──

async function main() {
  console.log("");
  console.log(bold("  Claude Terminal — Setup"));
  console.log("");

  // Check if server is running
  const portFree = await isPortFree(parseInt(process.env.PORT || "3000", 10));
  if (!portFree) {
    console.log(red("  Error: Port 3000 is in use. Stop the server before running setup."));
    process.exit(1);
  }

  // Check if .env.local already exists
  const envPath = path.join(__dirname, ".env.local");
  if (fs.existsSync(envPath)) {
    console.log(yellow("  Warning: .env.local already exists."));
    const overwrite = await askYN("Overwrite?", false);
    if (!overwrite) {
      console.log("  Aborted.");
      process.exit(0);
    }
    console.log("");
  }

  // ── Step 1: System Check ──
  console.log(bold("  Step 1/6: System Check"));
  console.log("");

  // Node.js version
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.slice(1).split(".")[0], 10);
  if (nodeMajor >= 18) {
    ok(`Node.js ${nodeVersion} (required: 18+)`);
  } else {
    fail(`Node.js ${nodeVersion} — version 18+ required`);
    process.exit(1);
  }

  // build-essential / python3 (for native modules)
  const hasPython = which("python3");
  if (hasPython) {
    ok("python3 found (needed for native modules)");
  } else {
    warn("python3 not found — needed for npm install (node-pty, better-sqlite3)");
    console.log("     sudo apt install -y python3");
  }

  const hasGcc = which("gcc");
  if (hasGcc) {
    ok("build-essential found");
  } else {
    warn("gcc not found — build-essential may be needed for npm install");
    console.log("     sudo apt install -y build-essential");
  }

  // Xvfb
  const hasXvfb = which("Xvfb");
  if (hasXvfb) {
    ok("Xvfb found");
  } else {
    warn("Xvfb not found (optional — needed for image clipboard bridge)");
    console.log("     sudo apt install -y xvfb");
  }

  // xclip
  const hasXclip = which("xclip");
  if (hasXclip) {
    ok("xclip found");
  } else {
    warn("xclip not found (optional — needed for image clipboard bridge)");
    console.log("     sudo apt install -y xclip");
  }

  // Claude CLI
  const claudePath = which("claude");
  if (claudePath) {
    ok(`Claude CLI found at ${claudePath}`);
    console.log(`     ${dim("Make sure to run `claude` once to authenticate before starting the server")}`);
  } else {
    warn("Claude CLI not found");
    console.log("     npm install -g @anthropic-ai/claude-code");
    const cont = await askYN("Continue anyway?", false);
    if (!cont) {
      process.exit(0);
    }
  }

  console.log("");

  // ── Step 2: Admin Account ──
  console.log(bold("  Step 2/6: Admin Account"));
  console.log("");

  let adminLogin;
  while (true) {
    adminLogin = await ask("Login", "admin");
    if (/^[a-zA-Z0-9._-]+$/.test(adminLogin)) break;
    console.log(red("    Login can only contain letters, numbers, dots, hyphens, underscores"));
  }

  let adminPassword;
  while (true) {
    adminPassword = await askPassword("Password");
    if (adminPassword.length < 4) {
      console.log(red("    Password must be at least 4 characters"));
      continue;
    }
    const confirm = await askPassword("Confirm password");
    if (adminPassword !== confirm) {
      console.log(red("    Passwords don't match"));
      continue;
    }
    break;
  }

  const adminFirstName = await ask("First name", "Admin");

  console.log("");

  // ── Step 3: Deployment ──
  console.log(bold("  Step 3/6: Deployment"));
  console.log("");

  const deployChoice = await askChoice("Deployment mode:", [
    "Domain + SSL (production)",
    "Localhost (development)",
  ]);

  let appUrl;
  let host;
  if (deployChoice === 0) {
    const domain = await ask("Domain (e.g. claude.example.com)");
    appUrl = `https://${domain}`;
    host = "0.0.0.0";
  } else {
    appUrl = "http://localhost:3000";
    host = "127.0.0.1";
  }

  console.log("");

  // ── Step 4: Email (optional) ──
  console.log(bold("  Step 4/6: Email (optional)"));
  console.log("");

  let smtpHost = "", smtpPort = "", smtpUser = "", smtpPass = "", adminEmail = "";
  const configureSMTP = await askYN("Configure SMTP for registration approval emails?", false);

  if (configureSMTP) {
    smtpHost = await ask("SMTP host", "smtp.gmail.com");
    smtpPort = await ask("SMTP port", "587");
    smtpUser = await ask("SMTP user (email)");
    smtpPass = await askPassword("SMTP password");
    adminEmail = await ask("Admin email (receives notifications)", smtpUser);
  } else {
    console.log(dim("    → Users can be approved via admin panel or: node approve.js"));
  }

  console.log("");

  // ── Step 5: Guest Access (optional) ──
  console.log(bold("  Step 5/6: Guest Access (optional)"));
  console.log("");

  let guestCode = "";
  const enableGuest = await askYN("Enable guest access?", false);
  if (enableGuest) {
    guestCode = await ask("Guest code (Enter = auto-generate)");
    if (!guestCode) {
      guestCode = crypto.randomBytes(4).toString("hex");
      console.log(`    Generated: ${cyan(guestCode)}`);
    }
  }

  console.log("");

  // ── Step 6: Summary ──
  console.log(bold("  Step 6/6: Summary"));
  console.log("");
  console.log(`    Admin login:    ${cyan(adminLogin)}`);
  console.log(`    Admin name:     ${adminFirstName}`);
  console.log(`    App URL:        ${appUrl}`);
  console.log(`    Host:           ${host}`);
  console.log(`    SMTP:           ${configureSMTP ? green("configured") : dim("not configured")}`);
  console.log(`    Guest access:   ${enableGuest ? green(guestCode) : dim("disabled")}`);
  console.log("");

  const confirm = await askYN("Apply this configuration?", true);
  if (!confirm) {
    console.log("  Aborted.");
    process.exit(0);
  }

  console.log("");

  // ── Generate and write .env.local ──

  const jwtSecret = crypto.randomBytes(64).toString("hex");
  const sessionTimeout = "24";

  let envContent = `# Claude Terminal — Configuration\n`;
  envContent += `# Generated by setup.js on ${new Date().toISOString()}\n\n`;
  envContent += `JWT_SECRET=${jwtSecret}\n`;
  envContent += `SESSION_TIMEOUT_HOURS=${sessionTimeout}\n\n`;
  envContent += `# Server bind address (0.0.0.0 for Docker/external access, 127.0.0.1 for local only)\n`;
  envContent += `HOST=${host}\n\n`;
  envContent += `# Public URL (for email links)\n`;
  envContent += `APP_URL=${appUrl}\n\n`;

  if (guestCode) {
    envContent += `# Guest access code\n`;
    envContent += `GUEST_ACCESS_CODE=${guestCode}\n\n`;
  } else {
    envContent += `# Guest access (uncomment and set a code to enable)\n`;
    envContent += `#GUEST_ACCESS_CODE=your_secret_code\n\n`;
  }

  if (configureSMTP) {
    envContent += `# Admin email for registration notifications\n`;
    envContent += `ADMIN_EMAIL=${adminEmail}\n\n`;
    envContent += `# SMTP settings\n`;
    envContent += `SMTP_HOST=${smtpHost}\n`;
    envContent += `SMTP_PORT=${smtpPort}\n`;
    envContent += `SMTP_USER=${smtpUser}\n`;
    envContent += `SMTP_PASS=${smtpPass}\n`;
  } else {
    envContent += `# SMTP settings (optional — without SMTP, approve users via admin panel)\n`;
    envContent += `# ADMIN_EMAIL=admin@example.com\n`;
    envContent += `# SMTP_HOST=smtp.gmail.com\n`;
    envContent += `# SMTP_PORT=587\n`;
    envContent += `# SMTP_USER=your_email@gmail.com\n`;
    envContent += `# SMTP_PASS=your_app_password\n`;
  }

  // Write .env.local with restricted permissions
  fs.writeFileSync(envPath, envContent, { mode: 0o600 });
  ok(".env.local written (mode 0600)");

  // ── Load env vars so db.js can use JWT_SECRET ──
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    const val = trimmed.slice(eqIdx + 1);
    process.env[key] = val;
  }

  // ── Create DB + seed admin ──
  const db = require("./db");

  // Check if admin already exists
  const existingAdmin = db.prepare(
    "SELECT id FROM users WHERE role = 'admin' AND status = 'approved'"
  ).get();

  if (existingAdmin) {
    console.log(dim("  Admin user already exists in database — skipping creation"));
  } else {
    const bcrypt = require("bcryptjs");
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    // Get next color_index
    const maxColor = db.prepare("SELECT COALESCE(MAX(color_index), -1) as mc FROM users").get();
    const colorIndex = (maxColor.mc + 1) % 12;

    // Check if login is taken
    const existingLogin = db.prepare("SELECT id FROM users WHERE login = ?").get(adminLogin.toLowerCase());
    if (existingLogin) {
      warn(`Login "${adminLogin}" already exists — updating to admin role`);
      db.prepare(
        "UPDATE users SET role = 'admin', status = 'approved', password_hash = ? WHERE login = ?"
      ).run(passwordHash, adminLogin.toLowerCase());
    } else {
      db.prepare(
        `INSERT INTO users (login, password_hash, first_name, last_name, role, status, color_index)
         VALUES (?, ?, ?, '', 'admin', 'approved', ?)`
      ).run(adminLogin.toLowerCase(), passwordHash, adminFirstName, colorIndex);
    }

    ok(`Admin user "${adminLogin}" created`);
  }

  console.log("");
  console.log(green("  Setup complete!"));
  console.log("");
  console.log("  Next steps:");
  console.log(`    1. ${bold("npm run build")}     — build for production`);
  console.log(`    2. ${bold("npm run start")}     — start the server`);
  console.log(`    3. Open ${cyan(appUrl)} and login as ${cyan(adminLogin)}`);

  if (!configureSMTP) {
    console.log("");
    console.log(dim("  To approve registered users without SMTP:"));
    console.log(dim("    • Use the admin panel in the web UI"));
    console.log(dim("    • Or run: node approve.js list / node approve.js approve <login>"));
  }

  if (claudePath) {
    console.log("");
    console.log(yellow("  Reminder: Run `claude` in the terminal once to authenticate before starting the server."));
  }

  console.log("");

  rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(red("  Setup failed:"), err.message);
  rl.close();
  process.exit(1);
});
