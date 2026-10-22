import "server-only";
import nodemailer from "nodemailer";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

export function mailConfiguration() {
  const origin = process.env.APP_ORIGIN;
  if (!origin) return null;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return null;
  }
  if (url.pathname !== "/" || url.search || url.hash || url.username || url.password)
    return null;
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
  if (process.env.MAIL_TRANSPORT === "file" && local)
    return { origin: url.origin, mode: "file" as const };
  if (
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASSWORD &&
    process.env.MAIL_FROM
  )
    return { origin: url.origin, mode: "smtp" as const };
  return null;
}

export async function sendAccountMail(
  to: string,
  purpose: "reset" | "verify",
  token: string,
) {
  const config = mailConfiguration();
  if (!config) throw new Error("MAIL_NOT_CONFIGURED");
  const route = purpose === "reset" ? "/reset-password" : "/verify-email";
  // A fragment keeps the token out of HTTP access logs and Referer headers.
  const link = `${config.origin}${route}#token=${token}`;
  const subject =
    purpose === "reset" ? "Rota — Şifreni yenile" : "Rota — E-posta adresini doğrula";
  const text =
    purpose === "reset"
      ? `Şifreni yenilemek için bağlantıyı aç:\n${link}\n\nBağlantı 30 dakika geçerlidir ve yalnızca bir kez kullanılabilir. Bu isteği sen yapmadıysan bu mesajı yok sayabilirsin.`
      : `E-posta adresini doğrulamak için bağlantıyı aç:\n${link}\n\nBağlantı 24 saat geçerlidir ve yalnızca bir kez kullanılabilir. Bu isteği sen yapmadıysan bu mesajı yok sayabilirsin.`;
  if (config.mode === "file") {
    const folder =
      process.env.MAIL_FILE_DIRECTORY || path.join(process.cwd(), "work", "mail");
    await mkdir(folder, { recursive: true, mode: 0o700 });
    await writeFile(
      path.join(folder, `${randomUUID()}.json`),
      JSON.stringify({ to, purpose, subject, text, link }, null, 2),
      { mode: 0o600 },
    );
    return;
  }
  const port = Number(process.env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("INVALID_SMTP_PORT");
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASSWORD! },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    logger: false,
    debug: false,
  });
  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject,
    text,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}
