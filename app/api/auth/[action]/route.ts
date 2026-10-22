import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  cookieName,
  createSession,
  currentUser,
  hashToken,
  passwordHash,
  passwordMatches,
  sameOrigin,
} from "@/lib/auth";
import { allowAttempt, issueAccountToken } from "@/lib/account-tokens";
import { mailConfiguration } from "@/lib/mail";
export const runtime = "nodejs";
const reply = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const genericMailReply = {
  ok: true,
  message:
    "Bu e-posta için uygun bir hesap varsa bağlantı gönderildi. Gelen kutunu ve spam klasörünü kontrol et.",
};
const invalidLink = () =>
  reply(
    {
      error:
        "Bağlantı geçersiz, süresi dolmuş veya daha önce kullanılmış. Yeni bir bağlantı isteyin.",
    },
    400,
  );
const requiresVerification = () => process.env.REQUIRE_EMAIL_VERIFICATION === "true";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  if (!sameOrigin(req))
    return reply(
      { error: "Bu istek uygulamanın açık olduğu adresten gönderilmelidir." },
      403,
    );
  const { action } = await params;
  if (
    ![
      "login",
      "register",
      "logout",
      "forgot-password",
      "reset-password",
      "resend-verification",
      "verify-email",
    ].includes(action)
  )
    return reply({ error: "İşlem bulunamadı." }, 404);
  try {
    if (action === "logout") {
      const jar = await cookies(),
        token = jar.get(cookieName)?.value;
      if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
      jar.set(cookieName, "", {
        httpOnly: true,
        path: "/",
        maxAge: 0,
        sameSite: "lax",
        secure: process.env.APP_ORIGIN?.startsWith("https://") ?? false,
      });
      return reply({ ok: true });
    }
    if (!req.headers.get("content-type")?.includes("application/json"))
      return reply({ error: "Geçersiz veri." }, 400);
    if (Number(req.headers.get("content-length") || 0) > 16000)
      return reply({ error: "İstek çok büyük." }, 413);
    const text = await req.text();
    if (Buffer.byteLength(text) > 16000) return reply({ error: "İstek çok büyük." }, 413);
    let raw;
    try {
      raw = JSON.parse(text);
    } catch {
      return reply({ error: "Geçersiz veri." }, 400);
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      return reply({ error: "Geçersiz veri." }, 400);

    if (action === "reset-password" || action === "verify-email") {
      if (typeof raw.token !== "string" || !/^[a-f0-9]{64}$/.test(raw.token))
        return invalidLink();
      if (!(await allowAttempt("token", hashToken(raw.token), 10)))
        return reply({ error: "Çok fazla deneme. Daha sonra tekrar deneyin." }, 429);
      const purpose = action === "reset-password" ? "reset" : "verify";
      if (
        purpose === "reset" &&
        (typeof raw.password !== "string" ||
          raw.password.length < 10 ||
          raw.password.length > 128)
      )
        return reply({ error: "Şifreniz 10–128 karakter olmalıdır." }, 400);
      const tokenHash = hashToken(raw.token);
      const record = await db.accountToken.findUnique({ where: { tokenHash } });
      if (!record || record.purpose !== purpose || record.expiresAt <= new Date())
        return invalidLink();
      const hashed = purpose === "reset" ? await passwordHash(raw.password) : null;
      const consumed = await db.$transaction(async (tx) => {
        const result = await tx.accountToken.deleteMany({
          where: { tokenHash, purpose, expiresAt: { gt: new Date() } },
        });
        if (!result.count) return false;
        if (purpose === "reset") {
          await tx.user.update({
            where: { id: record.userId },
            data: { passwordHash: hashed! },
          });
          await tx.session.deleteMany({ where: { userId: record.userId } });
          await tx.accountToken.deleteMany({
            where: { userId: record.userId, purpose: "reset" },
          });
          const owner = await tx.user.findUniqueOrThrow({ where: { id: record.userId } });
          await tx.authAttempt.deleteMany({
            where: { key: hashToken(`login:${owner.email}`) },
          });
        } else {
          await tx.user.update({
            where: { id: record.userId },
            data: { emailVerifiedAt: new Date() },
          });
          await tx.accountToken.deleteMany({
            where: { userId: record.userId, purpose: "verify" },
          });
        }
        return true;
      });
      if (!consumed) return invalidLink();
      return reply({
        ok: true,
        message:
          purpose === "reset"
            ? "Şifren yenilendi. Yeni şifrenle giriş yapabilirsin."
            : "E-posta adresin doğrulandı. Giriş yapabilirsin.",
      });
    }

    const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return reply({ error: "Geçerli bir e-posta adresi girin." }, 400);
    if (["forgot-password", "resend-verification"].includes(action)) {
      if (!mailConfiguration())
        return reply(
          {
            error:
              "E-posta gönderimi henüz yapılandırılmadı. Uygulama yöneticisiyle iletişime geçin.",
          },
          503,
        );
      if (!(await allowAttempt(action, email, 3)))
        return reply({ error: "Çok fazla istek. 15 dakika sonra tekrar deneyin." }, 429);
      const user = await db.user.findUnique({ where: { email } });
      if (user && (action === "forgot-password" || !user.emailVerifiedAt)) {
        // Delivery failures must not reveal whether an account exists.
        try {
          await issueAccountToken(
            user.id,
            user.email,
            action === "forgot-password" ? "reset" : "verify",
          );
        } catch {
          console.error("Account email delivery failed; check SMTP configuration.");
        }
      }
      return reply(genericMailReply);
    }

    const password = raw.password;
    if (typeof password !== "string" || password.length > 128 || !password.length)
      return reply({ error: "Geçerli bir şifre girin." }, 400);
    if (!(await allowAttempt("login", email)))
      return reply(
        { error: "Çok fazla deneme yaptınız. 15 dakika sonra tekrar deneyin." },
        429,
      );
    let user;
    let emailDelivery: "sent" | "unavailable" | "failed" = "unavailable";
    if (action === "register") {
      if (requiresVerification() && !mailConfiguration())
        return reply(
          { error: "Hesap kaydı için e-posta servisi yapılandırılmalıdır." },
          503,
        );
      const name = typeof raw.name === "string" ? raw.name.trim() : "";
      if (name.length < 2 || name.length > 80 || password.length < 10)
        return reply(
          { error: "Adınız 2–80, şifreniz en az 10 karakter olmalıdır." },
          400,
        );
      const hashed = await passwordHash(password);
      user = await db.$transaction(async (tx) => {
        const first = (await tx.user.count()) === 0;
        const created = await tx.user.create({
          data: { name, email, passwordHash: hashed },
        });
        if (first)
          await tx.application.updateMany({
            where: { userId: null },
            data: { userId: created.id },
          });
        return created;
      });
      if (mailConfiguration()) {
        try {
          await issueAccountToken(user.id, user.email, "verify");
          emailDelivery = "sent";
        } catch {
          emailDelivery = "failed";
        }
      }
      if (requiresVerification())
        return reply(
          {
            ok: true,
            verificationRequired: true,
            emailDelivery,
            message:
              emailDelivery === "sent"
                ? "Hesabın oluşturuldu. E-postana gelen bağlantıyla adresini doğrula."
                : "Hesabın oluşturuldu fakat e-posta gönderilemedi. Doğrulama bağlantısını yeniden istemeyi deneyin.",
          },
          201,
        );
    } else {
      user = await db.user.findUnique({ where: { email } });
      const valid = await passwordMatches(
        password,
        user?.passwordHash ?? `${"0".repeat(32)}:${"0".repeat(128)}`,
      );
      if (!user || !valid) return reply({ error: "E-posta veya şifre hatalı." }, 401);
      if (requiresVerification() && !user.emailVerifiedAt)
        return reply(
          {
            error: "Giriş yapmadan önce e-posta adresini doğrula.",
            code: "EMAIL_UNVERIFIED",
          },
          403,
        );
    }
    await db.authAttempt.deleteMany({ where: { key: hashToken(`login:${email}`) } });
    await createSession(user.id);
    return reply({ ok: true, emailDelivery }, action === "register" ? 201 : 200);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return reply(
        {
          error:
            "Bu e-posta ile hesap oluşturulamıyor. Mevcut hesabınızla giriş yapmayı deneyin.",
        },
        409,
      );
    return reply({ error: "İşlem tamamlanamadı. Lütfen tekrar deneyin." }, 500);
  }
}
export async function GET() {
  const user = await currentUser();
  return reply(
    user ? { user } : { error: "Oturum açmanız gerekiyor." },
    user ? 200 : 401,
  );
}
