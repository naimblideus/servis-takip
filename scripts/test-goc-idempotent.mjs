// GÖÇLER İDEMPOTENT Mİ — her deploy'da baştan koşuyorlar
// Çalıştır:  node scripts/test-goc-idempotent.mjs   (sunucu gerekmez)
//
// NEDEN BU TEST
// `apply-migrations.js` üretimde HER AÇILIŞTA prisma/migrations altındaki
// TÜM dosyaları baştan koşturuyor. Şema ifadeleri sorun değil ("already
// exists" yakalanıp atlanıyor) ama VERİ ifadeleri sorun:
//
//   UPDATE "Part" SET "avgCost" = "buyPrice" WHERE "buyPrice" > 0;
//
// Bu satır her deploy'da hesaplanmış ağırlıklı ortalamayı son alış
// fiyatıyla ezerdi ve bütün maliyet verisi sessizce bozulurdu. Rakam makul
// görünmeye devam ettiği için kimse fark etmezdi. (Bu hata gerçekten
// yazıldı ve bu test yazılırken düzeltildi.)
//
// Kural: veri yazan her ifade KENDİNİ TEKRAR ETMEYECEK şekilde korunmalı.
//   INSERT  → ON CONFLICT ... DO NOTHING  ya da  WHERE NOT EXISTS
//   UPDATE  → yalnız değişmesi gerekeni seçen bir WHERE
//             (IS NULL / NOT EXISTS / <> / != / IS DISTINCT FROM)
//   DELETE  → WHERE zorunlu
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIZIN = join(KOK, 'prisma', 'migrations');

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

/** SQL'i ifadelere böl — apply-migrations.js ile AYNI kural. */
function ifadeler(sql) {
  const out = [];
  let buf = '', dolar = false;
  for (const satir of sql.split('\n')) {
    const s = satir.trim();
    if (s.startsWith('--')) continue;
    buf += satir + '\n';
    if (((satir.match(/\$\$/g) || []).length) % 2) dolar = !dolar;
    if (!dolar && s.endsWith(';')) { out.push(buf.trim()); buf = ''; }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

/** Veri yazan ifade mi, ve korunmuş mu? */
export function korunmusMu(ifade) {
  const s = ifade.replace(/\s+/g, ' ').trim();
  const u = s.toUpperCase();

  if (/^INSERT\s+INTO/i.test(s)) {
    // Sabit VALUES ile tek satır eklemek de tekrar eder.
    if (/ON\s+CONFLICT/i.test(u)) return { veri: true, ok: true };
    if (/WHERE\s+NOT\s+EXISTS/i.test(u)) return { veri: true, ok: true };
    return { veri: true, ok: false, sebep: 'INSERT korumasız (ON CONFLICT ya da WHERE NOT EXISTS yok)' };
  }

  if (/^(WITH\b[\s\S]*?)?UPDATE\s/i.test(s) && /\bUPDATE\s+"/i.test(u)) {
    if (!/\bWHERE\b/i.test(u)) {
      return { veri: true, ok: false, sebep: 'UPDATE hiç WHERE içermiyor — tüm tabloyu her deploy ezer' };
    }
    // Yalnız DEĞİŞMESİ GEREKENİ seçen bir koşul aranıyor. "WHERE x > 0"
    // gibi bir koşul her koşuda aynı satırları yeniden yazar.
    const daraltan = /IS\s+NULL|NOT\s+EXISTS|<>|!=|IS\s+DISTINCT\s+FROM|NOT\s+IN\s*\(/i.test(u);
    if (!daraltan) {
      return { veri: true, ok: false, sebep: 'UPDATE koşulu her koşuda aynı satırları yeniden yazıyor (IS NULL / NOT EXISTS / <> yok)' };
    }
    return { veri: true, ok: true };
  }

  if (/^DELETE\s+FROM/i.test(s)) {
    if (!/\bWHERE\b/i.test(u)) return { veri: true, ok: false, sebep: 'DELETE hiç WHERE içermiyor' };
    return { veri: true, ok: true };
  }

  return { veri: false, ok: true };
}

console.log('\n★ KENDİ KURALIMIZ ÇALIŞIYOR MU\n');
{
  // Gerçekten yazılmış ve bu testle yakalanan hata:
  const hata = korunmusMu('UPDATE "Part" SET "avgCost" = "buyPrice" WHERE "buyPrice" > 0;');
  t('★ korumasız UPDATE yakalanıyor', hata.veri && !hata.ok, hata);
  t('sebebi yazıyor', /yeniden yazıyor/.test(hata.sebep || ''), hata.sebep);

  const duzgun = korunmusMu('UPDATE "Part" SET "avgCost" = "buyPrice" WHERE "avgCost" IS NULL AND "buyPrice" > 0;');
  t('★ IS NULL ile korunmuş UPDATE geçiyor', duzgun.ok, duzgun);

  t('WHERE\'siz UPDATE yakalanıyor', !korunmusMu('UPDATE "Part" SET "avgCost" = 0;').ok);
  t('<> ile korunmuş UPDATE geçiyor', korunmusMu('UPDATE "Device" SET "brand" = \'Canon\' WHERE "brand" <> \'Canon\';').ok);
  t('NOT EXISTS ile korunmuş UPDATE geçiyor',
    korunmusMu('UPDATE "A" SET x = 1 WHERE NOT EXISTS (SELECT 1 FROM "B");').ok);

  t('★ korumasız INSERT yakalanıyor', !korunmusMu('INSERT INTO "X" ("id") SELECT "id" FROM "Y";').ok);
  t('ON CONFLICT ile korunmuş INSERT geçiyor',
    korunmusMu('INSERT INTO "X" ("id") SELECT "id" FROM "Y" ON CONFLICT ("id") DO NOTHING;').ok);
  t('WHERE NOT EXISTS ile korunmuş INSERT geçiyor',
    korunmusMu('INSERT INTO "X" ("id") SELECT "id" FROM "Y" WHERE NOT EXISTS (SELECT 1 FROM "X");').ok);

  t('WHERE\'siz DELETE yakalanıyor', !korunmusMu('DELETE FROM "X";').ok);
  t('şema ifadesi veri sayılmıyor', !korunmusMu('CREATE TABLE "X" ("id" TEXT);').veri);
  t('ALTER veri sayılmıyor', !korunmusMu('ALTER TABLE "X" ADD COLUMN "y" TEXT;').veri);
  t('CREATE INDEX veri sayılmıyor', !korunmusMu('CREATE INDEX "i" ON "X"("y");').veri);
}

console.log('\n★ GERÇEK GÖÇ DOSYALARI\n');
{
  t('göç klasörü var', existsSync(DIZIN));
  const klasorler = readdirSync(DIZIN).filter((f) => existsSync(join(DIZIN, f, 'migration.sql'))).sort();
  t('göç dosyaları bulundu', klasorler.length > 0, klasorler.length);

  const sorunlular = [];
  let veriIfadesi = 0;
  for (const f of klasorler) {
    const sql = readFileSync(join(DIZIN, f, 'migration.sql'), 'utf8');
    for (const ifade of ifadeler(sql)) {
      if (!ifade) continue;
      const k = korunmusMu(ifade);
      if (!k.veri) continue;
      veriIfadesi++;
      if (!k.ok) sorunlular.push({ goc: f, sebep: k.sebep, ifade: ifade.replace(/\s+/g, ' ').slice(0, 110) });
    }
  }

  console.log(`  (${klasorler.length} göç · ${veriIfadesi} veri ifadesi tarandı)`);
  t('★ HİÇBİR GÖÇ İKİNCİ KOŞUDA VERİYİ BOZMUYOR', sorunlular.length === 0, sorunlular);
  // Test anlamlı olsun diye: gerçekten veri yazan göçler var mı?
  t('taramada veri ifadesi bulundu (test boşa çalışmıyor)', veriIfadesi >= 5, veriIfadesi);
}

console.log('\nGÖÇ UYGULAYICI HÂLÂ HER ŞEYİ BAŞTAN KOŞTURUYOR MU\n');
{
  // Bu testin varlık sebebi apply-migrations.js'in davranışı. Davranış
  // değişirse (örn. uygulanmışları atlamaya başlarsa) bu test gereksizleşir
  // ama yanlış bir güven de vermemeli — o yüzden kontrol ediliyor.
  const kaynak = readFileSync(join(KOK, 'apply-migrations.js'), 'utf8');
  t('★ uygulayıcı hâlâ TÜM klasörleri okuyor', /readdirSync\(dir\)/.test(kaynak));
  t('★ uygulanmışları atlayan bir kayıt tutmuyor', !/_prisma_migrations/.test(kaynak));
  t('idempotent hataları yutuyor', /already exists\|duplicate/.test(kaynak));
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
