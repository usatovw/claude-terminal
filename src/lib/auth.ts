import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;
const PASSWORD_HASH = process.env.PASSWORD_HASH!;
const SESSION_TIMEOUT = parseInt(process.env.SESSION_TIMEOUT_HOURS || "24", 10);

export async function verifyPassword(password: string): Promise<boolean> {
  return bcrypt.compare(password, PASSWORD_HASH);
}

export function createToken(): string {
  return jwt.sign(
    { role: "admin", iat: Math.floor(Date.now() / 1000) },
    JWT_SECRET,
    { expiresIn: `${SESSION_TIMEOUT}h` }
  );
}

export function verifyToken(token: string): boolean {
  try {
    jwt.verify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}
