import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;
const SESSION_TIMEOUT = parseInt(process.env.SESSION_TIMEOUT_HOURS || "24", 10);

export interface JwtPayload {
  userId: number;
  login: string;
  firstName: string;
  lastName: string;
  role: "admin" | "user" | "guest";
}

export interface DbUser {
  id: number;
  login: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: "admin" | "user" | "guest";
  status: "pending" | "approved" | "rejected";
  color_index: number;
  created_at: string;
}

export async function verifyUserPassword(
  user: DbUser,
  password: string
): Promise<boolean> {
  return bcrypt.compare(password, user.password_hash);
}

export function createToken(payload: JwtPayload): string {
  return jwt.sign(
    { ...payload, iat: Math.floor(Date.now() / 1000) },
    JWT_SECRET,
    { expiresIn: `${SESSION_TIMEOUT}h` }
  );
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}

/** Backward-compatible boolean check */
export function isTokenValid(token: string): boolean {
  return verifyToken(token) !== null;
}
