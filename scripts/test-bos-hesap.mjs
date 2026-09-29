// BOŞ HESAP TURU — yeni bayinin ilk günü
// Çalıştır:  node scripts/test-bos-hesap.mjs   (önce `npm run dev`; yerel veritabanına yazar)
//
// NEDEN BU TEST
// Satışta bayinin gördüğü İLK şey boş bir hesap: müşterisi, cihazı, sayacı,
// faturası yok. Demo verisiyle yazılmış ekranlar boş veride çöker (sıfıra
// bölme, boş dizide `[0].x`, olmayan ayar kaydı) ve bunu geliştirici hiç
// görmez, çünkü onun hesabı doludur. Deneme süresi tam bu ekranlarla başlar.
//
// Test sıfırdan bir bayi ve yönetici açar, gerçek giriş akışıyla oturum alır:
//   · diskteki HER panel sayfasını açar (sunucu hatası yok),
//   · her sayfanın kaynağındaki okuma uçlarını (/api/... GET) çağırır:
//     boş hesapta hiçbiri 500 vermemeli ve JSON dönmeli,
//   · aynısını TEKNİSYEN olarak yapar (yetkisiz uç 403 verebilir, çökemez).
// Yeni eklenen sayfa ve uçlar diskten okunduğu için kendiliğinden kapsanır.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const KOK_DIZIN = join(dirname(fileURLToPath(import.meta.url)), '..');
const p = new PrismaClient();
const KOK = process.env.SAYAC_TEST_KOK || 'http://localhost:3002';

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

try { await fetch(`${KOK}/api/rozetler`, { signal: AbortSignal.timeout(8000) }); } catch {
  console.log(`ATLANDI: ${KOK} ayakta değil (önce npm run dev).`);
  await p.$disconnect(); process.exit(0);
}

// ── Sayfalar ve okuma uçları diskten ─────────────────────────────────────
const PANEL = join(KOK_DIZIN, 'src/app/(dashboard)');
const sayfalar = readdirSync(PANEL, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(PANEL, d.name, 'page.tsx')))
  .map((d) => d.name);

const tsxDosyalari = (dizin) => {
  const out = [];
  for (const d of readdirSync(dizin, { withFileTypes: true })) {
    const yol = join(dizin, d.name);
    // Alt sayfalar ([id], new) kimlik ister; boş hesapta açılacak kayıt yok.
    if (d.isDirectory()) { if (!d.name.startsWith('[') && d.name !== 'new') out.push(...tsxDosyalari(yol)); }
    else if (/\.tsx?$/.test(d.name)) out.push(yol);
  }
  return out;
};

/** Sayfa kaynağındaki sabit GET uçları. Şablonlu (${...}) olanlar atlanır. */
function okumaUclari(sayfa) {
  const uclar = new Set();
  for (const dosya of tsxDosyalari(join(PANEL, sayfa))) {
    const k = readFileSync(dosya, 'utf8');
    for (const m of k.matchAll(/fetch\(\s*(['"`])(\/api\/[^'"`]+)\1\s*(,\s*\{[^}]*\})?/g)) {
      const url = m[2];
      const secenek = m[3] ?? '';
      if (url.includes('${')) continue;
      if (/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/.test(secenek)) continue;
      uclar.add(url);
    }
  }
  return [...uclar];
}

const SLUG = 'test-bos-hesap';
const GIRIS = [{ eposta: 'bos-yonetici@test.local', rol: 'ADMIN' }, { eposta: 'bos-teknisyen@test.local', rol: 'TECHNICIAN' }];
const PAROLA = 'bos-hesap-deneme-1';

async function oturum(eposta) {
  const c = await fetch(`${KOK}/api/auth/csrf`);
  const cc = (c.headers.get('set-cookie') || '').split(';')[0];
  const { csrfToken } = await c.json();
  const g = await fetch(`${KOK}/api/auth/callback/credentials`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: cc },
    body: new URLSearchParams({ email: eposta, password: PAROLA, csrfToken, redirect: 'false', json: 'true' }),
    redirect: 'manual',
  });
  const cs = [cc];
  for (const x of (g.headers.getSetCookie?.() ?? [])) cs.push(x.split(';')[0]);
  return cs.join('; ');
}

console.log(`\nBoş hesap turu — ${sayfalar.length} sayfa\n`);

let bayiId = null;
try {
  const eski = await p.tenant.findFirst({ where: { slug: SLUG }, select: { id: true } });
  if (eski) await p.tenant.delete({ where: { id: eski.id } });
  const hash = await bcrypt.hash(PAROLA, 10);
  const bayi = await p.tenant.create({
    data: {
      name: 'Boş Hesap Bayisi', slug: SLUG, plan: 'trial',
      trialEndsAt: new Date(Date.now() + 14 * 86400000),
      users: { create: GIRIS.map((g) => ({ email: g.eposta, passwordHash: hash, name: g.rol, role: g.rol, isActive: true })) },
    },
    select: { id: true },
  });
  bayiId = bayi.id;

  for (const g of GIRIS) {
    const cerez = await oturum(g.eposta);
    // Giriş başarısızsa her sayfa girişe yönlenir ve test "hata yok" der.
    // Önce oturumun gerçekten bu kullanıcıya ait olduğu kanıtlanıyor.
    const ses = await fetch(`${KOK}/api/auth/session`, { headers: { cookie: cerez } }).then((r) => r.json()).catch(() => null);
    t(`[${g.rol}] giriş gerçekten yapıldı`, ses?.user?.email === g.eposta, ses);
    const sayfaHatasi = [], ucHatasi = [], jsonDegil = [];
    let ucSayisi = 0, acilan = 0, cevapli = 0;
    const giriseYonlenen = [];
    for (const s of sayfalar) {
      const y = await fetch(`${KOK}/${s}`, { headers: { cookie: cerez }, redirect: 'manual', signal: AbortSignal.timeout(60000) });
      const govde = y.status === 200 ? await y.text() : '';
      if (y.status === 200) acilan++;
      // Başka bir sayfaya yönlendirme bilinçli kilit (teknisyen /dashboard → /tickets,
      // yönetici olmayan /users → /dashboard). Girişe yönlenme ise oturum düştü demek.
      if (y.status >= 300 && y.status < 400 && /\/login/.test(y.headers.get('location') ?? '')) giriseYonlenen.push(`/${s}`);
      // 307: teknisyen ana panelden işlerine yönleniyor — beklenen.
      if (y.status >= 500 || (y.status === 200 && /Application error|Internal Server Error/.test(govde))) sayfaHatasi.push(`/${s} → ${y.status}`);
      for (const u of okumaUclari(s)) {
        ucSayisi++;
        const r = await fetch(`${KOK}${u}`, { headers: { cookie: cerez }, redirect: 'manual', signal: AbortSignal.timeout(60000) });
        if (r.status === 200) cevapli++;
        if (r.status >= 500) { ucHatasi.push(`${u} (${s}) → ${r.status}: ${(await r.text()).slice(0, 160)}`); continue; }
        if (r.status === 200 && (r.headers.get('content-type') ?? '').includes('json')) {
          try { await r.json(); } catch { jsonDegil.push(`${u} (${s})`); }
        }
      }
    }
    t(`[${g.rol}] ★ hiçbir sayfa girişe yönlenmedi (oturum ayakta): ${acilan}/${sayfalar.length} açıldı`, giriseYonlenen.length === 0 && acilan >= sayfalar.length - 3, { acilan, giriseYonlenen });
    t(`[${g.rol}] okuma çağrılarının çoğu veri döndü: ${cevapli}/${ucSayisi}`, cevapli >= ucSayisi * (g.rol === 'ADMIN' ? 0.9 : 0.5), cevapli);
    t(`[${g.rol}] ★ ${sayfalar.length} sayfanın hiçbiri boş hesapta çökmüyor`, sayfaHatasi.length === 0, sayfaHatasi);
    t(`[${g.rol}] ★ sayfaların ${ucSayisi} okuma çağrısının hiçbiri 500 vermiyor`, ucHatasi.length === 0, ucHatasi);
    t(`[${g.rol}] JSON diyen uçlar gerçekten JSON dönüyor`, jsonDegil.length === 0, jsonDegil);
  }
} catch (e) {
  kaldi++;
  console.log('  ✗ beklenmeyen hata:', e?.stack ?? e);
} finally {
  if (bayiId) await p.tenant.delete({ where: { id: bayiId } }).catch(() => {});
  await p.$disconnect();
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
