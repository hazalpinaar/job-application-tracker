import fs from "node:fs";
import path from "node:path";

if (fs.existsSync(".env")) process.loadEnvFile(".env");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl?.startsWith("file:")) {
  throw new Error("SQLite için .env dosyasında DATABASE_URL=file:./dev.db tanımlayın.");
}
const filename = decodeURIComponent(databaseUrl.slice(5).split("?")[0]);
const target = path.isAbsolute(filename) ? filename : path.resolve("prisma", filename);
fs.mkdirSync(path.dirname(target), { recursive: true });
// Create only when missing; never truncate an existing database.
try {
  fs.closeSync(fs.openSync(target, "ax"));
} catch (error) {
  if (error.code !== "EEXIST") throw error;
}
