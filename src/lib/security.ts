import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Token aleatorio apto para URLs (32 bytes por defecto). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** IP del cliente según Vercel (primer valor de x-forwarded-for). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
