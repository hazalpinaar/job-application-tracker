import "server-only";
import { cookies } from "next/headers";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
export const cookieName = "rota_session";
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export async function currentUser() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await db.session.findUnique({where:{tokenHash:hashToken(token)},include:{user:true}});
  if (!session || session.expiresAt <= new Date()) return null;
  return {id:session.user.id,name:session.user.name,email:session.user.email};
}
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve,reject)=>scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024},(error,key)=>error?reject(error):resolve(key)));
}
export async function passwordHash(password:string) {
  const salt=randomBytes(16).toString("hex");
  return `${salt}:${(await derive(password,salt)).toString("hex")}`;
}
export async function passwordMatches(password:string, stored:string) {
  const [salt,key]=stored.split(":");
  const actual=await derive(password,salt);
  const expected=Buffer.from(key,"hex");
  return expected.length===actual.length && timingSafeEqual(expected,actual);
}
export function sameOrigin(req:Request) {
  const url = new URL(req.url);
  const expected = process.env.APP_ORIGIN || `${url.protocol}//${req.headers.get("host") ?? url.host}`;
  return req.headers.get("origin") === expected;
}
export async function createSession(userId:string) {
  const token=randomBytes(32).toString("hex");
  const expiresAt=new Date(Date.now()+7*24*60*60*1000);
  await db.session.deleteMany({where:{expiresAt:{lt:new Date()}}});
  await db.session.create({data:{tokenHash:hashToken(token),userId,expiresAt}});
  (await cookies()).set(cookieName,token,{httpOnly:true,sameSite:"lax",secure:process.env.APP_ORIGIN?.startsWith("https://") ?? false,path:"/",expires:expiresAt});
}
