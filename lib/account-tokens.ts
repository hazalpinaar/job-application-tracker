import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/auth";
import { sendAccountMail } from "@/lib/mail";

export async function issueAccountToken(
  userId: string,
  email: string,
  purpose: "reset" | "verify",
) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  await db.accountToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await db.accountToken.create({
    data: {
      tokenHash,
      userId,
      purpose,
      expiresAt: new Date(
        Date.now() + (purpose === "reset" ? 30 * 60 * 1000 : 24 * 60 * 60 * 1000),
      ),
    },
  });
  try {
    await sendAccountMail(email, purpose, token);
  } catch (error) {
    await db.accountToken.deleteMany({ where: { tokenHash } });
    throw error;
  }
}

export async function allowAttempt(scope: string, identifier: string, limit = 10) {
  const key = hashToken(`${scope}:${identifier}`);
  await db.authAttempt.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  const row = await db.authAttempt.upsert({
    where: { key },
    create: { key, expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
    update: { count: { increment: 1 } },
  });
  return row.count <= limit;
}
