import { db } from "@/lib/db";
import { validate } from "@/lib/application";
import { currentUser, sameOrigin } from "@/lib/auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export async function GET() {
  const user = await currentUser();
  if (!user) return reply({ error: "Oturum açmanız gerekiyor." }, 401);
  try {
    return reply(
      await db.application.findMany({
        where: { userId: user.id },
        orderBy: [{ appliedAt: "desc" }, { createdAt: "desc" }],
      }),
    );
  } catch {
    return reply({ error: "Başvurular yüklenemedi." }, 500);
  }
}
async function mutate(req: Request, method: string) {
  if (!sameOrigin(req)) return reply({ error: "Geçersiz kaynak." }, 403);
  const user = await currentUser();
  if (!user) return reply({ error: "Oturumunuz sona erdi. Tekrar giriş yapın." }, 401);
  let raw: Record<string, unknown>;
  try {
    raw = await req.json();
  } catch {
    return reply({ error: "Geçersiz veri." }, 400);
  }
  if (!raw || typeof raw !== "object") return reply({ error: "Geçersiz veri." }, 400);
  if (method !== "POST" && (typeof raw.id !== "string" || !raw.id))
    return reply({ error: "Başvuru bulunamadı." }, 400);
  let data;
  if (method !== "DELETE") {
    try {
      data = validate(raw);
    } catch (e) {
      return reply({ error: (e as Error).message }, 400);
    }
  }
  try {
    if (method === "POST")
      return reply(
        await db.application.create({ data: { ...data!, userId: user.id } }),
        201,
      );
    const where = { id: raw.id as string, userId: user.id };
    if (method === "DELETE") {
      const result = await db.application.deleteMany({ where });
      return result.count
        ? reply({ ok: true })
        : reply({ error: "Başvuru bulunamadı." }, 404);
    }
    const result = await db.application.updateMany({ where, data: data! });
    if (!result.count) return reply({ error: "Başvuru bulunamadı." }, 404);
    return reply(await db.application.findFirst({ where }));
  } catch {
    return reply({ error: "İşlem tamamlanamadı. Tekrar deneyin." }, 500);
  }
}
export const POST = (r: Request) => mutate(r, "POST");
export const PUT = (r: Request) => mutate(r, "PUT");
export const DELETE = (r: Request) => mutate(r, "DELETE");
