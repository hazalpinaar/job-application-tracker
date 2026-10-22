import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { cookieName, createSession, currentUser, hashToken, passwordHash, passwordMatches, sameOrigin } from "@/lib/auth";
export const runtime="nodejs";
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
export async function POST(req:Request,{params}:{params:Promise<{action:string}>}) {
 if(!sameOrigin(req)) return reply({error:"Bu istek uygulamanın açık olduğu adresten gönderilmelidir."},403);
 const {action}=await params;
 if(!["login","register","logout"].includes(action)) return reply({error:"İşlem bulunamadı."},404);
 try {
  if(action==="logout") {
   const jar=await cookies(), token=jar.get(cookieName)?.value;
   if(token) await db.session.deleteMany({where:{tokenHash:hashToken(token)}});
   jar.set(cookieName,"",{httpOnly:true,path:"/",maxAge:0,sameSite:"lax",secure:process.env.APP_ORIGIN?.startsWith("https://")??false});
   return reply({ok:true});
  }
  if(!req.headers.get("content-type")?.includes("application/json")) return reply({error:"Geçersiz veri."},400);
  let raw; try {raw=await req.json();} catch {return reply({error:"Geçersiz veri."},400);}
  if(!raw || typeof raw.email!=="string" || typeof raw.password!=="string") return reply({error:"E-posta ve şifre zorunludur."},400);
  const email=raw.email.trim().toLowerCase(), password=raw.password;
  if(email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length>128 || !password.length) return reply({error:"Geçerli bir e-posta ve şifre girin."},400);
  const key=hashToken(email);
  await db.authAttempt.deleteMany({where:{expiresAt:{lt:new Date()}}});
  const attempt=await db.authAttempt.upsert({where:{key},create:{key,expiresAt:new Date(Date.now()+15*60*1000)},update:{count:{increment:1}}});
  if(attempt.count>10) return reply({error:"Çok fazla deneme yaptınız. 15 dakika sonra tekrar deneyin."},429);
  let user;
  if(action==="register") {
   const name=typeof raw.name==="string"?raw.name.trim():"";
   if(name.length<2 || name.length>80 || password.length<10) return reply({error:"Adınız 2–80, şifreniz en az 10 karakter olmalıdır."},400);
   const hashed=await passwordHash(password);
   user=await db.$transaction(async tx=>{
    const first=await tx.user.count()===0;
    const created=await tx.user.create({data:{name,email,passwordHash:hashed}});
    if(first) await tx.application.updateMany({where:{userId:null},data:{userId:created.id}});
    return created;
   });
  } else {
   user=await db.user.findUnique({where:{email}});
   // Perform the same expensive operation even for unknown accounts.
   const valid=await passwordMatches(password,user?.passwordHash??`${"0".repeat(32)}:${"0".repeat(128)}`);
   if(!user || !valid) return reply({error:"E-posta veya şifre hatalı."},401);
  }
  await db.authAttempt.deleteMany({where:{key}});
  await createSession(user.id);
  return reply({ok:true},action==="register"?201:200);
 } catch(error) {
  if(error instanceof Prisma.PrismaClientKnownRequestError && error.code==="P2002") return reply({error:"Bu e-posta ile hesap oluşturulamıyor. Mevcut hesabınızla giriş yapmayı deneyin."},409);
  return reply({error:"İşlem tamamlanamadı. Lütfen tekrar deneyin."},500);
 }
}
export async function GET() {
 const user=await currentUser();
 return reply(user?{user}:{error:"Oturum açmanız gerekiyor."},user?200:401);
}
