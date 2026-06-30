import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const SESSION_COOKIE = "pournart_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters.");
  }

  return new TextEncoder().encode(secret);
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({
    name: user.name,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecretKey());

  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getSecretKey());

    if (!payload.sub || !payload.email || !payload.name || !payload.role) {
      return null;
    }

    return {
      id: payload.sub,
      name: String(payload.name),
      email: String(payload.email),
      role: String(payload.role),
    };
  } catch {
    return null;
  }
}

export async function requireUser() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function requireAdmin() {
  const session = await requireUser();

  if (session.role !== "ADMIN") {
    redirect("/account");
  }

  return session;
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
