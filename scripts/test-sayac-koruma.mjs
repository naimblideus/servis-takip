// SAYAÇ KORUMALARI — UÇTAN UCA, GERÇEK HTTP
// Çalıştır:  node scripts/test-sayac-koruma.mjs   (önce `npm run dev`)
//
// NEDEN AYRI TEST
// İki koruma da saf kütüphane olarak ayrıca test ediliyor (test-sayac-anomali,
// test-sayac-durgunluk). Bu test kuralın DOĞRU olduğunu değil, uca DOĞRU
// BAĞLANDIĞINI kanıtlıyor: kural mükemmel olsa da uç yanlış cihazı okuyor,
// yetki kapısı yok ya da başka bayinin verisi sızıyorsa sahada hiçbir işe
// yaramaz. Sayaç bu ürünün kalbi; her kapı tek tek denenmeli.
//
// Kapsanan:
//   POST /api/devices/[id]/readings → anomali uyarısı dönüyor mu
//   GET  /api/sayac/supheli         → faturalanmamış şüpheli okumalar
//   GET  /api/sayac/durgun          → sayacı gelen ama artmayan cihazlar
//   her ikisi için: giriş şartı + bayi izolasyonu
//
// Sunucu kapalıysa ATLAR, hata vermez.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const p = new PrismaClient();
const KOK = process.env.SAYAC_TEST_KOK || 'http://localhost:3002';

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

try {
  await fetch(`${KOK}/api/rozetler`);
} catch {
  console.log(`ATLANDI: ${KOK} ayakta değil (önce npm run dev).`);
  await p.$disconnect();
  process.exit(0);
}

const SLUG = 'test-sayac-koruma';
const SLUG_B = 'test-sayac-koruma-b';

async function girisYap(eposta, sifre) {
  const csrfY = await fetch(`${KOK}/api/auth/csrf`);
  const csrfCerez = (csrfY.headers.get('set-cookie') || '').split(';')[0];
  const { csrfToken } = await csrfY.json();
  const y = await fetch(`${KOK}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: csrfCerez },
    body: new URLSearchParams({ email: eposta, password: sifre, csrfToken, redirect: 'false', json: 'true' }),
    redirect: 'manual',
  });
  const cerezler = [csrfCerez];
  for (const c of (y.headers.getSetCookie?.() ?? [])) cerezler.push(c.split(';')[0]);
  return cerezler.join('; ');
}

const gunOnce = (n) => new Date(Date.now() - n * 86400000);

/** Bir bayi + müşteri + kiralık cihaz kur. */
async function bayiKur(slug, eposta) {
  const eski = await p.tenant.findFirst({ where: { slug } });
  if (eski) await p.tenant.delete({ where: { id: eski.id } });

  const tenant = await p.tenant.create({
    data: {
      name: slug, slug, pricePerBlack: 0.5, pricePerColor: 2.0,
      users: { create: { email: eposta, passwordHash: await bcrypt.hash('test1234', 12), name: 'Test', role: 'ADMIN', isActive: true } },
    },
  });
  const musteri = await p.customer.create({ data: { tenantId: tenant.id, name: 'Test Müşteri', phone: '5550000000' } });
  return { tenant, musteri };
}

/** Kiralık cihaz + verilen okuma noktaları. */
async function cihazKur(tenant, musteri, seri, noktalar, kira = 2000) {
  const cihaz = await p.device.create({
    data: {
      tenantId: tenant.id, customerId: musteri.id, brand: 'Kyocera', model: 'M2540',
      serialNo: seri, isRental: true, monthlyRent: kira,
      includedBlack: 0, includedColor: 0,
      publicCode: `TST-${seri}`, qrTokenHash: 'x',
      counterBlack: noktalar.at(-1).siyah, counterColor: 0,
    },
  });
  let onceki = null;
  for (const n of noktalar) {
    await p.counterReading.create({
      data: {
        tenantId: tenant.id, deviceId: cihaz.id,
        counterBlack: n.siyah, counterColor: 0,
        deltaBlack: onceki === null ? 0 : Math.max(0, n.siyah - onceki),
        deltaColor: 0, calculatedCost: 0, billed: true,
        source: 'CIHAZ_EPOSTA', readingDate: gunOnce(n.gun),
      },
    });
    onceki = n.siyah;
  }
  return cihaz;
}

try {
  // ── KURULUM ───────────────────────────────────────────────────────────
  const { tenant, musteri } = await bayiKur(SLUG, 'koruma@test.local');
  const { tenant: tenantB, musteri: musteriB } = await bayiKur(SLUG_B, 'korumab@test.local');

  // Ayda ~3.000 sayfa basan küçük ofis makinesi (4 okuma / 120 gün)
  const normalCihaz = await cihazKur(tenant, musteri, 'KORUMA-NORMAL',
    [{ gun: 120, siyah: 10000 }, { gun: 90, siyah: 13000 }, { gun: 60, siyah: 16000 }, { gun: 30, siyah: 19000 }]);

  // Sayacı geliyor ama HİÇ artmayan makine
  await cihazKur(tenant, musteri, 'KORUMA-DURGUN',
    [{ gun: 92, siyah: 45000 }, { gun: 61, siyah: 45000 }, { gun: 30, siyah: 45000 }, { gun: 1, siyah: 45000 }], 3300);

  // Öteki bayide de aynı desenler — sızıntı olursa görünür
  await cihazKur(tenantB, musteriB, 'KORUMA-B-DURGUN',
    [{ gun: 92, siyah: 8000 }, { gun: 61, siyah: 8000 }, { gun: 30, siyah: 8000 }, { gun: 1, siyah: 8000 }], 9999);

  const cerez = await girisYap('koruma@test.local', 'test1234');
  const cerezB = await girisYap('korumab@test.local', 'test1234');

  // ── GİRİŞ ŞARTI ───────────────────────────────────────────────────────
  console.log('\nGİRİŞSİZ ERİŞİM KAPALI\n');
  for (const uc of ['/api/sayac/supheli', '/api/sayac/durgun']) {
    const y = await fetch(`${KOK}${uc}`);
    t(`${uc} girişsiz reddediyor`, y.status === 401 || y.status === 403, y.status);
  }

  // ── ANOMALİ: OKUMA UCUNDAN ────────────────────────────────────────────
  console.log('\nANOMALİ UYARISI OKUMA UCUNDA\n');
  {
    // Normal ay: 19.000 → 22.000 (3.000 sayfa)
    const y = await fetch(`${KOK}/api/devices/${normalCihaz.id}/readings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie: cerez },
      body: JSON.stringify({ counterBlack: 22000, counterColor: 0 }),
    });
    const d = await y.json();
    t('normal okuma kabul ediliyor', y.ok, d);
    t('normal okumada uyarı YOK', !d.warning, d.warning);
  }
  {
    // Aynı makineye 150.000 sayfa: eski sabit eşik (200.000) bunu kaçırıyordu
    const y = await fetch(`${KOK}/api/devices/${normalCihaz.id}/readings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie: cerez },
      body: JSON.stringify({ counterBlack: 172000, counterColor: 0 }),
    });
    const d = await y.json();
    t('şüpheli okuma yine de KAYDEDİLİYOR (sistem sessizce para tutmuyor)', y.ok, d);
    t('uyarı dönüyor', typeof d.warning === 'string' && d.warning.length > 0, d.warning);
    t('uyarı makinenin normal hacmini AYNI süre üzerinden söylüyor', /normalde \d+ günde/.test(d.warning || ''), d.warning);
  }

  // ── ŞÜPHELİ LİSTESİ ───────────────────────────────────────────────────
  console.log('\nŞÜPHELİ OKUMA LİSTESİ\n');
  {
    const y = await fetch(`${KOK}/api/sayac/supheli`, { headers: { cookie: cerez } });
    const d = await y.json();
    t('uç cevap veriyor', y.ok, d);
    t('şüpheli okuma listeleniyor', d.toplam >= 1, d);
    const satir = (d.okumalar || []).find((o) => o.serialNo === 'KORUMA-NORMAL');
    t('doğru cihaz işaretlenmiş', !!satir, d.okumalar);
    t('faturaya girecek tutar bildiriliyor', typeof d.tutar === 'number' && d.tutar > 0, d.tutar);
    t('müşteri adı var (bayi kimi arayacağını biliyor)', satir?.musteri === 'Test Müşteri', satir);
    t('okumanın kaynağı bildiriliyor', typeof satir?.kaynak === 'string', satir);
    t('kıyas aynı süre üzerinden dönüyor', typeof satir?.gun === 'number' && typeof satir?.beklenen === 'number', satir);
    t('yalnız ŞÜPHELİ okuma listede — normal olan girmiyor',
      (d.okumalar || []).filter((o) => o.serialNo === 'KORUMA-NORMAL').length === 1, d.okumalar);
  }
  {
    const y = await fetch(`${KOK}/api/sayac/supheli`, { headers: { cookie: cerezB } });
    const d = await y.json();
    t('başka bayi bu şüpheli okumaları GÖRMÜYOR', d.toplam === 0, d);
  }

  // ── DURGUN LİSTESİ ────────────────────────────────────────────────────
  console.log('\nDURGUN CİHAZ LİSTESİ\n');
  {
    const y = await fetch(`${KOK}/api/sayac/durgun`, { headers: { cookie: cerez } });
    const d = await y.json();
    t('uç cevap veriyor', y.ok, d);
    const seriler = (d.musteriler || []).flatMap((m) => m.cihazlar.map((c) => c.serialNo));
    t('durgun cihaz yakalanıyor', seriler.includes('KORUMA-DURGUN'), seriler);
    t('normal cihaz listeye girmiyor', !seriler.includes('KORUMA-NORMAL'), seriler);
    t('risk altındaki aylık kira bildiriliyor', d.aylikRiskTutari === 3300, d.aylikRiskTutari);
  }
  {
    const y = await fetch(`${KOK}/api/sayac/durgun`, { headers: { cookie: cerezB } });
    const d = await y.json();
    const seriler = (d.musteriler || []).flatMap((m) => m.cihazlar.map((c) => c.serialNo));
    t('başka bayi yalnız KENDİ durgun cihazını görüyor',
      seriler.includes('KORUMA-B-DURGUN') && !seriler.includes('KORUMA-DURGUN'), seriler);
    t('başka bayinin kira riski karışmıyor', d.aylikRiskTutari === 9999, d.aylikRiskTutari);
  }

  // ── KANAL SAĞLIĞI ─────────────────────────────────────────────────────
  // Cihaz cihaz "sayacı gelmiyor" uyarısı, kanal durduğunda YANLIŞ SEBEBİ
  // gösteriyor: bayi 40 müşteriyi boşuna arar, oysa sorun köprüdedir.
  // Uyarı bu yüzden aynı cevapta ve listenin ÜSTÜNDE duruyor.
  console.log('\nKANAL DURUMU AYNI CEVAPTA GELİYOR\n');
  {
    // Önce hiç e-posta yok — kanal kurulmamış, uyarı olmamalı
    const y0 = await fetch(`${KOK}/api/sayac/eksik`, { headers: { cookie: cerez } });
    const d0 = await y0.json();
    t('kanal bilgisi cevapta var', !!d0.kanal, d0.kanal);
    t('hiç e-posta yokken uyarı verilmiyor', d0.kanal?.durum === 'KURULMAMIS', d0.kanal);

    // Günlük ritimle 12 rapor, sonuncusu 30 gün önce → köprü durmuş
    for (let i = 0; i < 12; i++) {
      await p.counterEmail.create({
        data: {
          tenantId: tenant.id, rawText: 'test', status: 'ISLENDI',
          receivedAt: gunOnce(30 + (11 - i)),
        },
      });
    }
    const y1 = await fetch(`${KOK}/api/sayac/eksik`, { headers: { cookie: cerez } });
    const d1 = await y1.json();
    t('günlük ritimden sonra 30 gün sessizlik DURDU sayılıyor', d1.kanal?.durum === 'DURDU', d1.kanal);
    t('bayiye kaç gündür sessiz olduğu söyleniyor', /30 gündür/.test(d1.kanal?.aciklama || ''), d1.kanal);

    // Öteki bayinin kanalı bundan etkilenmemeli
    const y2 = await fetch(`${KOK}/api/sayac/eksik`, { headers: { cookie: cerezB } });
    const d2 = await y2.json();
    t('başka bayinin kanal durumu karışmıyor', d2.kanal?.durum === 'KURULMAMIS', d2.kanal);

    // Bugün bir rapor gelsin — uyarı kalkmalı
    await p.counterEmail.create({
      data: { tenantId: tenant.id, rawText: 'test', status: 'ISLENDI', receivedAt: new Date() },
    });
    const y3 = await fetch(`${KOK}/api/sayac/eksik`, { headers: { cookie: cerez } });
    const d3 = await y3.json();
    t('yeni rapor gelince uyarı kendiliğinden kalkıyor', d3.kanal?.durum === 'CALISIYOR', d3.kanal);
  }

  // ── GEÇMİŞ DÖNEMDE UNUTULMUŞ OKUMA ────────────────────────────────────
  // Her iki para yolu da okumaları [dönem başı, dönem sonu) ile süzüyor.
  // Kapanmış bir ayda faturalanmadan kalan okuma bir daha HİÇBİR turun
  // kapsamına girmiyor: sonraki aylar yalnız kendi dönemine bakıyor.
  // Ölçüldü — gerçek bir bayide 2026-02'den kalmış ₺2.900'lük iki okuma
  // vardı ve ekranda hiç görünmüyordu. Sessiz, kalıcı kayıp.
  console.log('\nGEÇMİŞ DÖNEMDE UNUTULAN PARA GÖRÜNÜYOR\n');
  {
    const eskiCihaz = await cihazKur(tenant, musteri, 'KORUMA-ESKI',
      [{ gun: 150, siyah: 1000 }, { gun: 120, siyah: 4000 }], 1000);
    const eskiTarih = gunOnce(70);
    const eskiDonem = `${eskiTarih.getFullYear()}-${String(eskiTarih.getMonth() + 1).padStart(2, '0')}`;
    await p.counterReading.create({
      data: {
        tenantId: tenant.id, deviceId: eskiCihaz.id,
        counterBlack: 9000, counterColor: 0, deltaBlack: 5000, deltaColor: 0,
        calculatedCost: 1234.5, billed: false, source: 'CIHAZ_EPOSTA',
        readingDate: eskiTarih,
      },
    });

    const y = await fetch(`${KOK}/api/revenue-risk`, { headers: { cookie: cerez } });
    const d = await y.json();
    t('uç cevap veriyor', y.ok, d);
    const satir = (d.gecmisDonemler || []).find((g) => g.donem === eskiDonem);
    t('kapanmış aydaki faturalanmamış okuma görünüyor', !!satir, d.gecmisDonemler);
    t('o dönemin tutarı bildiriliyor', satir?.tutar >= 1234.5, satir);
    t('kaç okuma ve kaç cihaz olduğu yazıyor', satir?.okuma >= 1 && satir?.cihaz >= 1, satir);
    t('toplam da veriliyor (bayi tek rakam görüyor)', d.gecmisToplam >= 1234.5, d.gecmisToplam);
    t('içinde bulunulan dönem bu listeye KARIŞMIYOR',
      !(d.gecmisDonemler || []).some((g) => g.donem === d.period), d.gecmisDonemler);
  }
  {
    const y = await fetch(`${KOK}/api/revenue-risk`, { headers: { cookie: cerezB } });
    const d = await y.json();
    t('başka bayinin geçmiş dönem parası sızmıyor', (d.gecmisDonemler || []).length === 0, d.gecmisDonemler);
  }

  // ── BAYAT OTURUM ──────────────────────────────────────────────────────
  // Oturum jetonu tenantId taşıyor. Bayi kaydı silinip yeniden kurulduğunda
  // (taşıma, demo hesabının tazelenmesi) eski jeton ayakta kalıyordu ve panel
  // sessizce MODÜLSÜZ açılıyordu: kullanıcı içeride görünüyor ama her özellik
  // "paketinizde yok" diyor. Ölçüldü — demo hesabı tazelendikten sonra Kaçan
  // Gelir tam da böyle kayboldu. Ürünü satış görüşmesinin ortasında yoksun
  // gösteren bir hata; bu yüzden burada kilitleniyor.
  console.log('\nBAYAT OTURUM YENİDEN GİRİŞ İSTİYOR\n');
  {
    await p.tenant.delete({ where: { id: tenantB.id } });
    const y = await fetch(`${KOK}/dashboard`, { headers: { cookie: cerezB }, redirect: 'manual' });
    const nereye = y.headers.get('location') || '';
    t('silinmiş bayinin oturumu panele giremiyor', y.status >= 300 && y.status < 400, y.status);
    t('giriş ekranına sebebiyle yönlendiriliyor', /\/login\?hata=oturum-bayat/.test(nereye), nereye);
  }
} finally {
  for (const s of [SLUG, SLUG_B]) {
    const e = await p.tenant.findFirst({ where: { slug: s } });
    if (e) await p.tenant.delete({ where: { id: e.id } });
  }
  console.log('\n  (temizlik: test bayileri silindi)');
  await p.$disconnect();
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
