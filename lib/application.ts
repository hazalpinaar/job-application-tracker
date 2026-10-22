export const statuses = { APPLIED: "Başvuruldu", INTERVIEW: "Görüşme", OFFER: "Teklif", REJECTED: "Reddedildi" } as const;
export type Status = keyof typeof statuses;
export type Application = { id: string; company: string; position: string; url: string; appliedAt: string; status: Status; notes: string };
export function validate(input: unknown) {
  if (!input || typeof input !== "object") throw new Error("Geçersiz başvuru.");
  const v = input as Record<string, unknown>;
  const str = (key: string, max: number) => { if (typeof v[key] !== "string" || (v[key] as string).length > max) throw new Error("Alanları ve uzunluklarını kontrol edin."); return (v[key] as string).trim(); };
  const company = str("company", 120), position = str("position", 160), url = str("url", 2000), appliedAt = str("appliedAt", 10), status = str("status", 20), notes = str("notes", 5000);
  if (!company || !position) throw new Error("Şirket ve pozisyon zorunludur.");
  if (!Object.hasOwn(statuses, status)) throw new Error("Geçersiz durum.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(appliedAt) || !Number.isFinite(Date.parse(appliedAt)) || new Date(appliedAt).toISOString().slice(0,10) !== appliedAt) throw new Error("Geçerli bir tarih seçin.");
  if (url) { let parsed: URL; try { parsed = new URL(url); } catch { throw new Error("Geçerli bir ilan bağlantısı girin."); } if (!["https:","http:"].includes(parsed.protocol)) throw new Error("Bağlantı http veya https ile başlamalıdır."); }
  return { company, position, url, appliedAt, status, notes };
}
