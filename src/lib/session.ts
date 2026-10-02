import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "yagmur_session";

export type SessionUser = {
  sub: string;
  email: string;
  name: string;
};

function secret() {
  const value = process.env.AUTH_SECRET?.trim();
  if (!value) {
    throw new Error("AUTH_SECRET tanımlı değil. .env dosyasına rastgele bir değer yazın.");
  }
  return new TextEncoder().encode(value);
}

export async function signSession(user: SessionUser) {
  return new SignJWT({ email: user.email, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

export async function readSession(token: string | undefined | null) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const sub = String(payload.sub || "");
    const email = String(payload.email || "");
    const name = String(payload.name || "");
    if (!sub || !email) return null;
    return { sub, email, name };
  } catch {
    return null;
  }
}
