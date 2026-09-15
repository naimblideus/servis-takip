/**
 * VERİTABANI DURUM RAPORU — üretimde çalıştırılır, SALT OKUNUR.
 *
 * Çalıştırma (Coolify → uygulama → Terminal):
 *     node db-durum.js
 *
 * ── NEDEN VAR ────────────────────────────────────────────────────────────
 * "Veritabanı düzgün çalışmıyor" bir his; bu dosya onu ÖLÇÜME çeviriyor.
 * `/api/saglik` yalnız "açık mı" diye bakıyor — bağlantı havuzu dolmuş,
 * göçler yarım kalmış, tablo şişmiş ya da disk dolmak üzere olan bir
 * veritabanı o uca 200 döndürmeye devam eder.
 *
 * ── HİÇBİR ŞEY YAZMAZ ────────────────────────────────────────────────────
 * Sadece SELECT. Üretimde gözü kapalı çalıştırılabilsin diye böyle:
 * teşhis aracının kendisi vakayı değiştirmemeli.
 *
 * ── SIR SIZDIRMAZ ────────────────────────────────────────────────────────
 * DATABASE_URL, parola, kullanıcı verisi BASILMAZ. Çıktı olduğu gibi
 * paylaşılabilir (sunucu adı ve veritabanı adı görünür, o kadar).
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const OK = '  [OK]  ';
const UYARI = '  [!]   ';
const HATA = '  [X]   ';
const bulgular = [];
const not = (seviye, metin) => { bulgular.push({ seviye, metin }); console.log(seviye + metin); };

const mb = (bayt) => `${(Number(bayt) / 1024 / 1024).toFixed(1)} MB`;
const baslik = (s) => console.log('\n' + s + '\n' + '─'.repeat(s.length));

/** Bir sorgu patlarsa RAPOR DURMAZ: o başlık "ölçülemedi" der, diğerleri devam eder. */
async function dene(ad, f) {
  try { return await f(); }
  catch (e) {
    // Prisma hata mesajı BOŞ SATIRLA başlıyor; ilk satırı almak sebebi
    // gizliyordu ("ölçülemedi: " deyip susuyordu). İlk DOLU satır alınıyor.
    const sebep = String((e && e.message) || e).split('\n').map((x) => x.trim()).filter(Boolean)[0] || 'bilinmeyen hata';
    not(UYARI, `${ad} ölçülemedi: ${sebep.slice(0, 110)}`);
    return null;
  }
}

(async () => {
  console.log('\n═══ VERİTABANI DURUM RAPORU ═══');
  console.log('    ' + new Date().toLocaleString('tr-TR'));

  // ── 0. NEREYE BAĞLANIYOR ──────────────────────────────────────────────
  // "Veritabanı var ama bağlı değil" durumunun tek kesin cevabı burada.
  // PAROLA ASLA BASILMAZ — çıktı olduğu gibi paylaşılabilsin diye.
  baslik('0. HEDEF (DATABASE_URL)');
  if (!process.env.DATABASE_URL) {
    not(HATA, 'DATABASE_URL TANIMLI DEĞİL — uygulama hiçbir veritabanına bağlı değil.');
  } else {
    try {
      const u = new URL(process.env.DATABASE_URL);
      console.log(`          sunucu : ${u.hostname}:${u.port || '5432'}`);
      console.log(`          veritabanı : ${u.pathname.slice(1) || '(belirtilmemiş)'}`);
      console.log(`          kullanıcı  : ${u.username || '(yok)'}`);
      console.log('          parola     : ' + (u.password ? '(var, basılmadı)' : '(YOK)'));
      // localhost/127.0.0.1, konteynerin KENDİ içini gösterir. Coolify'da
      // veritabanı ayrı bir kaynak olduğu için adres onun SERVİS ADI
      // olmalı (ör. "servis-takip-db"). localhost görüyorsanız uygulama
      // yanlış yere bakıyor demektir.
      if (['localhost', '127.0.0.1', '::1'].includes(u.hostname)) {
        not(UYARI, 'adres localhost — konteynerin kendi içi. Coolify panelinde veritabanı AYRI bir kaynak ise burada onun servis adı yazmalı.');
      } else {
        not(OK, `hedef: ${u.hostname}`);
      }
    } catch {
      not(HATA, 'DATABASE_URL okunamadı — biçimi bozuk.');
    }
  }

  // ── 1. BAĞLANTI ───────────────────────────────────────────────────────
  baslik('1. BAĞLANTI');
  const t0 = Date.now();
  try {
    await p.$queryRaw`SELECT 1`;
    const ms = Date.now() - t0;
    not(ms < 200 ? OK : UYARI, `bağlantı ${ms} ms` + (ms >= 200 ? ' — yavaş; ağ ya da yük sorunu olabilir' : ''));
  } catch (e) {
    // Prisma hata metinleri BOŞ SATIRLA başlıyor; ilk satırı almak burada
    // "BAĞLANILAMIYOR: " deyip sebebi yutuyordu — hem de tam sebebin en çok
    // gerektiği anda. İlk DOLU satır alınıyor.
    // Ayrıca ilk dolu satır da yetmiyor: o satır Prisma'nın kalıbı
    // ("Invalid `prisma...` invocation:"). Asıl sebep ("sunucuya
    // ulaşılamıyor" / "parola geçersiz" / "böyle bir veritabanı yok")
    // kalıp satırları elendikten SONRA gelen ilk satırdır.
    const kalip = /^(Invalid `|Please make sure|\d+\s|\^|→)/;
    const satirlar = String((e && e.message) || e).split('\n').map((x) => x.trim()).filter(Boolean);
    const sebep = satirlar.find((x) => !kalip.test(x)) || satirlar[0] || 'bilinmeyen hata';
    // Hata metninde bağlantı dizesi geçebiliyor — ekran paylaşılabilsin diye maskele.
    const guvenli = sebep.replace(/(:\/\/[^:@\s/]+):[^@\s/]*@/g, '$1:***@');
    not(HATA, 'BAĞLANILAMIYOR: ' + guvenli.slice(0, 160));
    console.log('\nBaşka hiçbir şey ölçülemez. Yukarıdaki "0. HEDEF" satırlarına bakın:');
    console.log('adres doğru veritabanını gösteriyor mu, o servis ayakta mı?\n');
    await p.$disconnect().catch(() => {});
    process.exit(1);
  }

  await dene('sürüm', async () => {
    const [v] = await p.$queryRawUnsafe(
      `SELECT version() AS s, current_database() AS db, current_user AS ku,
              inet_server_addr()::text AS sunucu, inet_server_port() AS port`);
    console.log('          ' + String(v.s).split(',')[0]);
    console.log(`          veritabanı: ${v.db} · kullanıcı: ${v.ku} · sunucu: ${v.sunucu || 'yerel soket'}:${v.port || '-'}`);
  });

  // ── 2. BOYUT ──────────────────────────────────────────────────────────
  baslik('2. BOYUT');
  await dene('boyut', async () => {
    const [b] = await p.$queryRawUnsafe(`SELECT pg_database_size(current_database()) AS bayt`);
    console.log('          toplam: ' + mb(b.bayt));
    const tablolar = await p.$queryRawUnsafe(`
      SELECT c.relname AS ad,
             pg_total_relation_size(c.oid) AS bayt,
             COALESCE(s.n_live_tup, 0) AS satir
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
      WHERE c.relkind = 'r' AND n.nspname = 'public'
      ORDER BY pg_total_relation_size(c.oid) DESC LIMIT 8`);
    console.log('          en büyük tablolar:');
    for (const t of tablolar) {
      console.log(`            ${String(t.ad).padEnd(22)} ${mb(t.bayt).padStart(10)}  ~${Number(t.satir).toLocaleString('tr-TR')} satır`);
    }
  });

  // ── 3. BAĞLANTI HAVUZU ────────────────────────────────────────────────
  // Havuz dolduğunda uygulama "veritabanı yok" gibi davranır ama veritabanı
  // ayaktadır. En sık yaşanan "çalışmıyor" tablosu budur.
  baslik('3. BAĞLANTI HAVUZU');
  await dene('havuz', async () => {
    const [h] = await p.$queryRawUnsafe(`
      SELECT (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS tavan,
             (SELECT count(*)::int FROM pg_stat_activity) AS acik,
             (SELECT count(*)::int FROM pg_stat_activity WHERE state = 'active') AS calisan,
             (SELECT count(*)::int FROM pg_stat_activity WHERE state = 'idle in transaction') AS askida`);
    const oran = h.acik / Math.max(1, h.tavan);
    not(oran < 0.7 ? OK : oran < 0.9 ? UYARI : HATA,
      `bağlantı ${h.acik}/${h.tavan} (%${Math.round(oran * 100)}) · çalışan ${h.calisan}`);
    // "idle in transaction" açık kalmış işlem demek: kilit tutar, vacuum'u
    // engeller, havuzu yer. Uzun süre kalırsa sessizce her şeyi yavaşlatır.
    if (h.askida > 0) not(h.askida > 3 ? HATA : UYARI, `${h.askida} bağlantı "idle in transaction" — açık kalmış işlem, kilit tutuyor olabilir`);
    else not(OK, 'açıkta kalmış işlem yok');
  });

  // ── 4. GÖÇLER ─────────────────────────────────────────────────────────
  baslik('4. GÖÇLER');
  await dene('göçler', async () => {
    const [s] = await p.$queryRawUnsafe(`
      SELECT count(*)::int AS toplam,
             count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL)::int AS yarim,
             count(*) FILTER (WHERE rolled_back_at IS NOT NULL)::int AS geri
      FROM "_prisma_migrations"`);
    not(OK, `${s.toplam} göç kayıtlı`);
    // Yarım kalmış göç = şema belirsiz. Bir sonraki deploy'da hem uygulanmış
    // hem uygulanmamış sayılabilir; en tehlikeli durum budur.
    if (s.yarim) not(HATA, `${s.yarim} göç YARIM KALMIŞ — şema belirsiz`);
    if (s.geri) not(HATA, `${s.geri} göç GERİ ALINMIŞ`);
    if (!s.yarim && !s.geri) not(OK, 'yarım ya da geri alınmış göç yok');
    const son = await p.$queryRawUnsafe(
      `SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 3`);
    console.log('          son uygulananlar:');
    for (const m of son) console.log('            ' + m.migration_name + (m.finished_at ? '' : '  ← BİTMEMİŞ'));
  });

  // ── 5. ŞEMA ile KOD AYNI MI ───────────────────────────────────────────
  // Deploy yarıda kalmışsa tablo eksik olur ve uygulama yalnız O EKRANDA
  // patlar; kullanıcı "bazen çalışıyor" der.
  baslik('5. ŞEMA — kodun beklediği tablolar var mı');
  await dene('şema', async () => {
    const bekleniyor = [
      'Tenant', 'User', 'Customer', 'Device', 'ServiceTicket', 'CounterReading',
      'Part', 'PartPurchase', 'TicketPart', 'TonerChange', 'CustomerInvoice',
      'InvoiceLine', 'Contract', 'ContractDevice', 'Teklif', 'TeklifSatiri',
      'Payment', 'FinancialTransaction', 'AccountEntry', 'Expense',
    ];
    const varOlan = (await p.$queryRawUnsafe(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`)).map((r) => r.tablename);
    const eksik = bekleniyor.filter((t) => !varOlan.includes(t));
    if (eksik.length) not(HATA, 'EKSİK TABLO: ' + eksik.join(', '));
    else not(OK, `${bekleniyor.length} kritik tablonun hepsi yerinde (toplam ${varOlan.length} tablo)`);

    // Bu oturumda eklenen kolonlar — göç uygulanmadıysa burada görünür.
    const kolonlar = [
      ['Part', 'avgCost'], ['TicketPart', 'unitCost'],
      ['Tenant', 'ziyaretMaliyeti'], ['Tenant', 'hedefMarj'],
      ['CustomerInvoice', 'gibNo'], ['TonerChange', 'observedYield'],
    ];
    const eksikKolon = [];
    for (const [t, k] of kolonlar) {
      const [r] = await p.$queryRawUnsafe(
        `SELECT count(*)::int AS n FROM information_schema.columns
         WHERE table_schema='public' AND table_name=$1 AND column_name=$2`, t, k);
      if (!r.n) eksikKolon.push(`${t}.${k}`);
    }
    if (eksikKolon.length) not(HATA, 'EKSİK KOLON: ' + eksikKolon.join(', ') + ' — göç uygulanmamış');
    else not(OK, 'son eklenen kolonların hepsi yerinde');
  });

  // ── 6. ŞİŞME ve BAKIM ─────────────────────────────────────────────────
  // Ölü satır birikir ve autovacuum yetişemezse sorgular sessizce yavaşlar.
  baslik('6. ŞİŞME (ölü satır)');
  await dene('şişme', async () => {
    const satirlar = await p.$queryRawUnsafe(`
      SELECT relname AS ad, n_live_tup AS canli, n_dead_tup AS olu,
             GREATEST(last_autovacuum, last_vacuum) AS son_vacuum
      FROM pg_stat_user_tables
      WHERE n_dead_tup > 1000
      ORDER BY n_dead_tup DESC LIMIT 5`);
    if (!satirlar.length) { not(OK, 'kayda değer ölü satır yok'); return; }
    for (const t of satirlar) {
      const oran = Number(t.olu) / Math.max(1, Number(t.canli) + Number(t.olu));
      not(oran > 0.2 ? UYARI : OK,
        `${t.ad}: ${Number(t.olu).toLocaleString('tr-TR')} ölü satır (%${Math.round(oran * 100)})` +
        (t.son_vacuum ? ` · son temizlik ${new Date(t.son_vacuum).toLocaleDateString('tr-TR')}` : ' · HİÇ temizlenmemiş'));
    }
  });

  // ── 7. UZUN SORGU ve KİLİT ────────────────────────────────────────────
  baslik('7. UZUN SORGU / KİLİT');
  await dene('kilit', async () => {
    const uzun = await p.$queryRawUnsafe(`
      SELECT pid, state, EXTRACT(EPOCH FROM (now() - query_start))::int AS saniye,
             left(regexp_replace(query, '\\s+', ' ', 'g'), 70) AS sorgu
      FROM pg_stat_activity
      WHERE state <> 'idle' AND query_start < now() - interval '10 seconds'
        AND pid <> pg_backend_pid()
      ORDER BY query_start LIMIT 5`);
    if (!uzun.length) not(OK, '10 saniyeden uzun süren sorgu yok');
    else for (const q of uzun) not(UYARI, `${q.saniye} sn: ${q.sorgu}`);

    const [k] = await p.$queryRawUnsafe(
      `SELECT count(*)::int AS n FROM pg_locks WHERE NOT granted`);
    not(k.n ? HATA : OK, k.n ? `${k.n} sorgu KİLİT BEKLİYOR` : 'kilit bekleyen sorgu yok');
  });

  // ── 8. VERİ BÜTÜNLÜĞÜ ─────────────────────────────────────────────────
  // Uygulamaya özel: sessizce bozulan şeyler.
  baslik('8. VERİ BÜTÜNLÜĞÜ');
  await dene('bütünlük', async () => {
    const kontroller = [
      ['negatif stok', `SELECT count(*)::int AS n FROM "Part" WHERE "stockQty" < 0`],
      ['sahipsiz cihaz (müşterisi yok)', `SELECT count(*)::int AS n FROM "Device" d LEFT JOIN "Customer" c ON c.id = d."customerId" WHERE c.id IS NULL`],
      ['sahipsiz fiş (cihazı yok)', `SELECT count(*)::int AS n FROM "ServiceTicket" t LEFT JOIN "Device" d ON d.id = t."deviceId" WHERE d.id IS NULL`],
      ['sahipsiz fatura satırı', `SELECT count(*)::int AS n FROM "InvoiceLine" l LEFT JOIN "CustomerInvoice" i ON i.id = l."invoiceId" WHERE i.id IS NULL`],
      ['aynı GİB numarası iki belgede', `SELECT COALESCE(sum(c)::int, 0) AS n FROM (SELECT count(*) - 1 AS c FROM "CustomerInvoice" WHERE "gibNo" IS NOT NULL GROUP BY "tenantId", "gibNo" HAVING count(*) > 1) x`],
    ];
    for (const [ad, sql] of kontroller) {
      const [r] = await p.$queryRawUnsafe(sql);
      not(r.n ? HATA : OK, `${ad}: ${r.n}`);
    }
  });

  // ── 9. İŞ HACMİ ───────────────────────────────────────────────────────
  baslik('9. İÇERİK');
  await dene('içerik', async () => {
    const [s] = await p.$queryRawUnsafe(`
      SELECT (SELECT count(*)::int FROM "Tenant") AS bayi,
             (SELECT count(*)::int FROM "User") AS kullanici,
             (SELECT count(*)::int FROM "Customer") AS musteri,
             (SELECT count(*)::int FROM "Device") AS cihaz,
             (SELECT count(*)::int FROM "ServiceTicket") AS fis,
             (SELECT count(*)::int FROM "CounterReading") AS okuma,
             (SELECT count(*)::int FROM "CustomerInvoice") AS fatura`);
    console.log(`          ${s.bayi} bayi · ${s.kullanici} kullanıcı · ${s.musteri} müşteri · ${s.cihaz} cihaz`);
    console.log(`          ${s.fis} fiş · ${s.okuma} sayaç okuması · ${s.fatura} fatura`);
    // BOŞ VERİTABANI = şema kurulmuş ama içinde hiç kayıt yok. Tablolar
    // yerinde olduğu için uygulama hata vermez, ekranlar boş açılır ve
    // "veri kayboldu" sanılır. Gerçek veri BAŞKA bir veritabanındadır:
    // bağlantıyı değiştirmeden önce eskisinin nerede olduğu bulunmalı.
    if (s.bayi === 0 && s.kullanici === 0) {
      not(HATA, 'BU VERİTABANI BOŞ — tablolar var ama hiç kayıt yok. Uygulama muhtemelen YANLIŞ veritabanına bağlı; gerçek veri başka bir yerde duruyor olabilir. Bağlantıyı değiştirmeden önce eskisini bulun.');
    } else if (s.bayi > 0 && s.kullanici === 0) {
      not(HATA, 'Bayi var ama HİÇ KULLANICI YOK — kimse giriş yapamaz.');
    }
    const sonHareket = await p.$queryRawUnsafe(
      `SELECT max("createdAt") AS s FROM "ServiceTicket"`);
    if (sonHareket[0] && sonHareket[0].s) {
      const gun = Math.floor((Date.now() - new Date(sonHareket[0].s)) / 86400000);
      not(gun <= 7 ? OK : UYARI, `son fiş ${gun} gün önce açılmış`);
    }
  });

  // ── SONUÇ ─────────────────────────────────────────────────────────────
  const hata = bulgular.filter((b) => b.seviye === HATA);
  const uyari = bulgular.filter((b) => b.seviye === UYARI);
  console.log('\n═══ SONUÇ ═══\n');
  if (!hata.length && !uyari.length) {
    console.log('  Veritabanı SAĞLIKLI. Ölçülen hiçbir başlıkta sorun yok.\n');
  } else {
    if (hata.length) { console.log('  ÇÖZÜLMESİ GEREKEN:'); for (const b of hata) console.log('    • ' + b.metin); }
    if (uyari.length) { console.log('  İZLENMESİ GEREKEN:'); for (const b of uyari) console.log('    • ' + b.metin); }
    console.log('');
  }
  // Çıkış kodu: izleme aracına bağlanabilsin diye. 0 = sağlıklı.
  await p.$disconnect().catch(() => {});
  process.exit(hata.length ? 1 : 0);
})().catch(async (e) => {
  console.error('\nRAPOR ÇÖKTÜ: ' + e.message);
  await p.$disconnect().catch(() => {});
  process.exit(2);
});
