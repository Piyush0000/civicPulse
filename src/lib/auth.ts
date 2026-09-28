import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { config } from "./config";
import { q1 } from "./db";
import { REGION_BY_CODE } from "./regions";

// Two portals share one session format:
//  - Government: provisioned accounts only (no self sign-up). cm = Chief Minister's Office (approves),
//    policymaker = MP/MLA (endorses, simulates), analyst = department official (curates, executes), admin.
//  - Citizen: self sign-up; sees only their own complaints and gives feedback on completed work.
export type Role = "admin" | "analyst" | "policymaker" | "cm" | "citizen";
export type Session = { sub: string; email: string; name: string; role: Role; regions: string[]; portal: "gov" | "citizen" };

export const ROLE_LABEL: Record<Role, string> = {
  cm: "Chief Minister's Office",
  policymaker: "MP / MLA",
  analyst: "Department official",
  admin: "Platform admin",
  citizen: "Citizen",
};

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

type UserRow = { id: string; email: string; full_name: string; role: Role; password_hash: string; region_codes: string[]; is_active: boolean };

function toSession(u: UserRow): Session {
  return { sub: u.id, email: u.email, name: u.full_name, role: u.role, regions: u.region_codes, portal: u.role === "citizen" ? "citizen" : "gov" };
}

/** Portal-aware login: a citizen account cannot open the government console and vice versa. */
export async function login(identifier: string, password: string, portal: "gov" | "citizen" = "gov"): Promise<Session | null> {
  const u = await q1<UserRow>("SELECT * FROM users WHERE lower(email)=lower($1) OR (phone IS NOT NULL AND phone=$1)", [identifier.trim()]);
  if (!u || !u.is_active || !(await bcrypt.compare(password, u.password_hash))) return null;
  if ((portal === "citizen") !== (u.role === "citizen")) return null;
  return toSession(u);
}

export async function registerCitizen(input: { name: string; email?: string; phone?: string; password: string; region: string }): Promise<Session> {
  const email = (input.email || "").trim().toLowerCase();
  const phone = (input.phone || "").replace(/[^\d+]/g, "");
  if (!input.name.trim() || input.name.length > 80) throw new Error("Please enter your name");
  if (!email && !phone) throw new Error("Email or mobile number is required");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Invalid email");
  if (phone && !/^\+?\d{10,13}$/.test(phone)) throw new Error("Invalid mobile number");
  if (input.password.length < 6) throw new Error("Password must be at least 6 characters");
  if (!REGION_BY_CODE[input.region]) throw new Error("Unknown city");
  const exists = await q1("SELECT 1 FROM users WHERE (lower(email)=lower($1) AND $1 <> '') OR (phone=$2 AND $2 <> '')", [email, phone]);
  if (exists) throw new Error("An account already exists for this email or mobile");
  const hash = await bcrypt.hash(input.password, 10);
  // Citizens without an email get a non-routable placeholder so the email column stays unique.
  const row = await q1<UserRow>(
    `INSERT INTO users (email, password_hash, full_name, role, region_codes, phone) VALUES ($1,$2,$3,'citizen',$4,$5) RETURNING *`,
    [email || `${phone}@citizen.local`, hash, input.name.trim(), [input.region], phone || null],
  );
  return toSession(row!);
}

export async function currentSession(): Promise<Session | null> {
  const c = await cookies();
  return verifySession(c.get(SESSION_COOKIE)?.value);
}

// What each role may do (RBAC).
export const PERMS = {
  view: ["admin", "analyst", "policymaker", "cm"],
  editRequests: ["admin", "analyst"],
  decideRecommendations: ["admin", "cm"], // CM's office approves / rejects
  endorseRecommendations: ["admin", "policymaker"], // MPs/MLAs forward to the CM with a note
  executeWork: ["admin", "analyst"], // departments report work started / done
  simulate: ["admin", "policymaker", "cm", "analyst"],
  manageDatasets: ["admin", "analyst"],
  tuneScoring: ["admin", "analyst"],
  manageUsers: ["admin"],
  seed: ["admin"],
  citizen: ["citizen"],
} as const satisfies Record<string, readonly Role[]>;
export type Perm = keyof typeof PERMS;

export const can = (s: Session | null, p: Perm) => !!s && (PERMS[p] as readonly Role[]).includes(s.role);
