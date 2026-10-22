import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
mkdirSync("work", { recursive: true });
const temp = mkdtempSync(path.resolve("work/auth-test-"));
const databaseUrl = `file:${path.join(temp, "test.db").split(path.sep).join("/")}`;
const mailFolder = path.join(temp, "mail");
writeFileSync(path.join(temp, "test.db"), "");
const strictVerification = process.argv.includes("--require-verification");
const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  APP_ORIGIN: "http://127.0.0.1:3101",
  MAIL_TRANSPORT: "file",
  MAIL_FILE_DIRECTORY: mailFolder,
  REQUIRE_EMAIL_VERIFICATION: String(strictVerification),
};
const schema = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"],
  { env, encoding: "utf8" },
);
if (schema.status !== 0) throw Error(schema.stdout + schema.stderr);
const db = new PrismaClient({ datasourceUrl: databaseUrl });
const base = "http://127.0.0.1:3101";
let log = "";
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3101",
  ],
  { env, stdio: ["ignore", "pipe", "pipe"] },
);
server.stdout.on("data", (d) => {
  log += d;
});
server.stderr.on("data", (d) => {
  log += d;
});
async function call(route, method = "GET", data, cookie, origin = base) {
  return fetch(base + route, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
}
function mails(to, purpose) {
  return readdirSync(mailFolder)
    .map((file) => JSON.parse(readFileSync(path.join(mailFolder, file), "utf8")))
    .filter((mail) => mail.to === to && mail.purpose === purpose);
}
const rawToken = (mail) =>
  new URLSearchParams(new URL(mail.link).hash.slice(1)).get("token");
const cookieOf = (response) => response.headers.get("set-cookie").split(";")[0];
try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null) throw Error(`Test server exited: ${log}`);
    try {
      const r = await call("/api/applications");
      if (r.status === 401) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(ready, log);
  const root = await fetch(base, { redirect: "manual" });
  assert.equal(root.status, 307);
  assert.equal(root.headers.get("location"), "/login");
  if (strictVerification) {
    const credentials = {
      name: "Verified Test",
      email: "strict@example.test",
      password: "Strong-test-password-123",
    };
    let response = await call("/api/auth/register", "POST", credentials);
    assert.equal(response.status, 201);
    assert.equal(response.headers.get("set-cookie"), null);
    assert.equal((await response.json()).verificationRequired, true);
    response = await call("/api/auth/login", "POST", credentials);
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, "EMAIL_UNVERIFIED");
    const token = rawToken(mails(credentials.email, "verify")[0]);
    response = await call("/api/auth/verify-email", "POST", { token });
    assert.equal(response.status, 200);
    response = await call("/api/auth/login", "POST", credentials);
    assert.equal(response.status, 200);
    const cookie = cookieOf(response);
    response = await call("/api/applications", "GET", null, cookie);
    assert.equal(response.status, 200);
    await db.user.update({
      where: { email: credentials.email },
      data: { emailVerifiedAt: null },
    });
    response = await call("/api/applications", "GET", null, cookie);
    assert.equal(response.status, 401);
    console.log(
      "PASS: required email verification blocks login and sessions until verified.",
    );
  } else {
    const legacy = await db.application.create({
      data: { company: "Legacy", position: "Developer", appliedAt: "2026-10-18" },
    });
    const credentials = {
      name: "Test User",
      email: "first@example.test",
      password: "Test-only-password-123",
    };
    let r = await call("/api/auth/register", "POST", credentials);
    assert.equal(r.status, 201, await r.text());
    const first = cookieOf(r);
    assert.match(r.headers.get("set-cookie"), /HttpOnly/i);
    assert.match(r.headers.get("set-cookie"), /SameSite=lax/i);
    r = await call("/api/applications", "GET", null, first);
    assert.ok((await r.json()).some((a) => a.id === legacy.id));
    r = await call("/api/auth/register", "POST", {
      ...credentials,
      email: "second@example.test",
    });
    assert.equal(r.status, 201);
    const second = cookieOf(r);
    r = await call("/api/applications", "GET", null, second);
    assert.deepEqual(await r.json(), []);
    const data = {
      company: "Acme",
      position: "Engineer",
      url: "https://example.com/jobs/1",
      status: "APPLIED",
      appliedAt: "2026-10-18",
      notes: "Private",
    };
    r = await call("/api/applications", "POST", data, first);
    assert.equal(r.status, 201);
    const item = await r.json();
    for (const method of ["PUT", "DELETE"]) {
      r = await call("/api/applications", method, { ...data, id: item.id }, second);
      assert.equal(r.status, 404);
    }
    r = await call(
      "/api/applications",
      "PUT",
      { ...data, id: item.id, status: "INTERVIEW" },
      first,
    );
    assert.equal(r.status, 200);
    assert.equal((await r.json()).status, "INTERVIEW");
    r = await call(
      "/api/applications",
      "POST",
      { ...data, url: "javascript:alert(1)" },
      first,
    );
    assert.equal(r.status, 400);
    r = await call("/api/applications", "POST", data, first, "https://foreign.example");
    assert.equal(r.status, 403);
    r = await call("/api/auth/login", "POST", {
      ...credentials,
      password: "Wrong-password",
    });
    assert.equal(r.status, 401);
    r = await call("/api/auth/logout", "POST", {}, first);
    assert.equal(r.status, 200);
    r = await call("/api/applications", "GET", null, first);
    assert.equal(r.status, 401);
    r = await call("/api/auth/login", "POST", credentials);
    assert.equal(r.status, 200);
    const activeSession = cookieOf(r);

    const verifyToken = rawToken(mails(credentials.email, "verify")[0]);
    const stored = await db.accountToken.findFirst({
      where: { purpose: "verify", user: { email: credentials.email } },
    });
    assert.equal(
      stored.tokenHash,
      createHash("sha256").update(verifyToken).digest("hex"),
    );
    r = await call("/api/auth/reset-password", "POST", {
      token: verifyToken,
      password: "Another-password-123",
    });
    assert.equal(r.status, 400);
    r = await call("/api/auth/verify-email", "POST", { token: verifyToken });
    assert.equal(r.status, 200);
    assert.ok(
      (await db.user.findUnique({ where: { email: credentials.email } })).emailVerifiedAt,
    );
    r = await call("/api/auth/verify-email", "POST", { token: verifyToken });
    assert.equal(r.status, 400);
    r = await call("/api/auth/forgot-password", "POST", { email: credentials.email });
    assert.equal(r.status, 200);
    const knownReply = await r.json();
    r = await call("/api/auth/forgot-password", "POST", {
      email: "unknown@example.test",
    });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), knownReply);
    const resetToken = rawToken(mails(credentials.email, "reset")[0]);
    r = await call("/api/auth/reset-password", "POST", {
      token: resetToken,
      password: "short",
    });
    assert.equal(r.status, 400);
    const newPassword = "New-test-only-password-123";
    r = await call("/api/auth/reset-password", "POST", {
      token: resetToken,
      password: newPassword,
    });
    assert.equal(r.status, 200);
    r = await call("/api/applications", "GET", null, activeSession);
    assert.equal(r.status, 401);
    r = await call("/api/auth/reset-password", "POST", {
      token: resetToken,
      password: newPassword,
    });
    assert.equal(r.status, 400);
    r = await call("/api/auth/login", "POST", credentials);
    assert.equal(r.status, 401);
    r = await call("/api/auth/login", "POST", { ...credentials, password: newPassword });
    assert.equal(r.status, 200);
    const again = cookieOf(r);
    r = await call("/api/applications", "GET", null, again);
    assert.equal((await r.json()).length, 2);
    r = await call("/api/auth/forgot-password", "POST", { email: credentials.email });
    assert.equal(r.status, 200);
    const tokens = await db.accountToken.findMany({ where: { purpose: "reset" } });
    await db.accountToken.updateMany({
      where: { purpose: "reset" },
      data: { expiresAt: new Date(0) },
    });
    const expiredMail = mails(credentials.email, "reset").find((mail) =>
      tokens.some(
        (token) =>
          token.tokenHash === createHash("sha256").update(rawToken(mail)).digest("hex"),
      ),
    );
    r = await call("/api/auth/reset-password", "POST", {
      token: rawToken(expiredMail),
      password: newPassword,
    });
    assert.equal(r.status, 400);
    await db.session.updateMany({ data: { expiresAt: new Date(0) } });
    r = await call("/api/applications", "GET", null, again);
    assert.equal(r.status, 401);
    for (let i = 0; i < 11; i++)
      r = await call("/api/auth/login", "POST", {
        email: "nobody@example.test",
        password: "Wrong-password",
      });
    assert.equal(r.status, 429);
    for (let i = 0; i < 4; i++)
      r = await call("/api/auth/resend-verification", "POST", {
        email: "second@example.test",
      });
    assert.equal(r.status, 429);
    console.log(
      "PASS: registration, legacy records, isolation, CRUD, CSRF, logout, mail capture, verification, reset, token reuse/expiry, session revocation, rate limits.",
    );
  }
} finally {
  server.kill();
  await new Promise((resolve) => {
    if (server.exitCode !== null) resolve();
    else server.once("exit", resolve);
  });
  await db.$disconnect();
  rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
