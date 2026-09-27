import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { config } from "./config";
import { q1 } from "./db";

export type Role = "admin" | "analyst" | "policymaker";
export type Session = { sub: string; email: string; name: string; role: Role; regions: string[] };

export const SESSION_COOKIE = "cp_session";
const key = () => new TextEncoder().encode(config.secretKey);

export async function signSession(s: Session, ttl = "12h"): Promise<string> {
  return new SignJWT({ ...s }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(ttl).sign(key());
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<Session | null> {
  const u = await q1<{ id: string; email: string; full_name: string; role: Role; password_hash: string; region_codes: string[]; is_active: boolean }>(
    "SELECT * FROM users WHERE lower(email)=lower($1)",
    [email],
  );
  if (!u || !u.is_active || !(await bcrypt.compare(password, u.password_hash))) return null;
  return { sub: u.id, email: u.email, name: u.full_name, role: u.role, regions: u.region_codes };
}

export async function currentSession(): Promise<Session | null> {
  const c = await cookies();
  return verifySession(c.get(SESSION_COOKIE)?.value);
}

// What each role may do (RBAC). Policymakers decide; analysts curate data; admins do both + users.
export const PERMS = {
  view: ["admin", "analyst", "policymaker"],
  editRequests: ["admin", "analyst"],
  decideRecommendations: ["admin", "policymaker"],
  manageDatasets: ["admin", "analyst"],
  tuneScoring: ["admin", "analyst"],
  manageUsers: ["admin"],
  seed: ["admin"],
} as const satisfies Record<string, readonly Role[]>;
export type Perm = keyof typeof PERMS;

export const can = (s: Session | null, p: Perm) => !!s && (PERMS[p] as readonly Role[]).includes(s.role);
