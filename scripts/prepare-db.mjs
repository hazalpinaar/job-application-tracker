import fs from 'node:fs';
// SQLite schema engine may require the file to exist on Windows.
if (!fs.existsSync('prisma/dev.db')) fs.closeSync(fs.openSync('prisma/dev.db', 'a'));
