// Dinamik + idempotent migration uygulayıcı (startup.sh tarafından çağrılır).
// prisma/migrations/*/migration.sql dosyalarını sırayla okur ve @prisma/client
// üzerinden uygular. prisma CLI / engine GEREKTİRMEZ (runtime'da güvenilir).
// Idempotent: zaten var olan obje "already exists" hatası verince atlanır.
// Hiçbir hata sunucu başlamasını engellemez (her durumda exit 0).
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// SQL'i ifadelere böl — $$ DO-bloklarını (içindeki ; dahil) tek parça tutar.
function splitStatements(sql) {
  const stmts = [];
  let buf = '';
  let inDollar = false;
  for (const line of sql.split('\n')) {
    const t = line.trim();
    if (t.startsWith('--')) continue;
    buf += line + '\n';
    if (((line.match(/\$\$/g) || []).length) % 2) inDollar = !inDollar;
    if (!inDollar && t.endsWith(';')) {
      stmts.push(buf.trim());
      buf = '';
    }
  }
  if (buf.trim()) stmts.push(buf.trim());
  return stmts;
}

(async () => {
  const dir = path.join(__dirname, 'prisma', 'migrations');
  let folders = [];
  try {
    folders = fs
      .readdirSync(dir)
      .filter((f) => {
        try { return fs.existsSync(path.join(dir, f, 'migration.sql')); }
        catch { return false; }
      })
      .sort();
  } catch (e) {
    console.error('[migrate] migrations klasörü okunamadı (atlanıyor):', e.message);
    process.exit(0);
  }

  let applied = 0, skipped = 0, errors = 0, total = 0;
  for (const f of folders) {
    let sql;
    try { sql = fs.readFileSync(path.join(dir, f, 'migration.sql'), 'utf8'); }
    catch { continue; }
    for (const s of splitStatements(sql)) {
      if (!s) continue;
      total++;
      try {
        await p.$executeRawUnsafe(s);
        applied++;
      } catch (e) {
        const m = (e && e.message) || '';
        if (/already exists|does not exist|duplicate|relation .* already|column .* already/i.test(m)) {
          skipped++; // idempotent — obje zaten var/yok, normal
        } else {
          errors++;
          console.error('[migrate] HATA (' + f + '): ' + m.slice(0, 120));
        }
      }
    }
  }
  console.log(
    `[migrate] bitti: ${applied} uygulandı, ${skipped} atlandı (idempotent), ${errors} gerçek hata / ${total} ifade · ${folders.length} migration`
  );
  await p.$disconnect().catch(() => {});
})()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[migrate] fatal (sunucu yine de başlatılacak):', e && e.message);
    process.exit(0);
  });
