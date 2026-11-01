// BASKI FİYAT MOTORU — her model, kademe, seçenek, asgari tutar, KDV, yuvarlama
// Çalıştır:  node scripts/test-baski-fiyat.mjs   (sunucu ve veritabanı gerekmez)
//
// NEDEN BU TEST
// Fiyat motoru tezgahta, sipariş sayfasında ve iş ayrıntısında aynı tutarı
// üretmek zorunda. Yanlış fiyatın iki yüzü de sessiz:
//   · EKSİK FİYAT. Renkli baskının eki girilmemişse iş siyah-beyaz fiyatına
//     gider; şablondan gelen fiyatsız ürün 0 ₺'lik iş açar.
//   · KURUŞ KAYMASI. KDV ayrıştırması ve yuvarlama her işte bir kuruş
//     kaydırırsa kasa gün sonunda tutmaz.
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-baski-fiyat-'));
let F, S;
try {
  try {
    execFileSync(process.execPath, [
      join(KOK, 'node_modules/typescript/bin/tsc'),
      join(KOK, 'src/lib/baski-fiyat.ts'), join(KOK, 'src/lib/baski-sablon.ts'),
      '--outDir', g, '--module', 'esnext', '--target', 'es2022',
      '--moduleResolution', 'bundler', '--skipLibCheck',
    ], { stdio: 'pipe' });
  } catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
  const sy = join(g, 'baski-sablon.js');
  writeFileSync(sy, readFileSync(sy, 'utf8').replace("from './baski-fiyat'", "from './baski-fiyat.js'"), 'utf8');
  F = await import(pathToFileURL(join(g, 'baski-fiyat.js')).href);
  S = await import(pathToFileURL(sy).href);
} finally {
  rmSync(g, { recursive: true, force: true });
}

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const { urunTanimi, fiyatHesapla, fiyatliMi, eksikFiyatlar, kademeBul, kalemOzeti } = F;

// A4 renkli fotokopi: 1–99 sayfası 5 ₺, 100+ 4 ₺, 500+ 3 ₺. KDV dahil.
const A4 = urunTanimi({
  ad: 'A4 Renkli', fiyatModeli: 'SAYFA', kdvOrani: 20, kdvDahil: true,
  kademeler: [{ min: 1, fiyat: 500 }, { min: 100, fiyat: 400 }, { min: 500, fiyat: 300 }],
  secenekler: [
    { kod: 'yuz', ad: 'Yüz', zorunlu: true, degerler: [
      { kod: 'tek', ad: 'Tek yüz', tur: 'CARPAN', deger: 1, varsayilan: true },
      { kod: 'cift', ad: 'Çift yüz', tur: 'CARPAN', deger: 0.9, ciftYuz: true },
    ] },
    { kod: 'cilt', ad: 'Cilt', zorunlu: false, degerler: [
      { kod: 'yok', ad: 'Ciltsiz', tur: 'CARPAN', deger: 1, varsayilan: true },
      { kod: 'spiral', ad: 'Spiral', tur: 'BIRIM', taban: 'NUSHA', deger: 0, araliklar: [{ max: 50, deger: 3000 }, { max: 100, deger: 4500 }] },
    ] },
    { kod: 'lam', ad: 'Laminasyon', zorunlu: false, degerler: [
      { kod: 'evet', ad: 'Laminasyonlu', tur: 'BIRIM', taban: 'YAPRAK', deger: 1000 },
    ] },
    { kod: 'acil', ad: 'Acil', zorunlu: false, degerler: [
      { kod: 'evet', ad: 'Aynı gün', tur: 'SABIT', deger: 5000 },
    ] },
  ],
});

console.log('\nBaskı fiyat motoru\n');

// ── SAYFA ───────────────────────────────────────────────────────────────
{
  const r = fiyatHesapla(A4, { adet: 1, sayfa: 10 });
  t('SAYFA: 10 sayfa × 5 ₺ = 50 ₺', r.ok && r.toplam === 5000 && r.miktar === 10 && r.birimFiyat === 500, r);
  t('★ sayfa dosyadan gelmediyse tahmini', r.tahmini === true);
  t('dosyadan gelen sayfa tahmini değil', fiyatHesapla(A4, { adet: 1, sayfa: 10, sayfaDosyadan: true }).tahmini === false);
  const k = fiyatHesapla(A4, { adet: 2, sayfa: 60 });
  t('★ kademe TOPLAM yüze göre: 2 nüsha × 60 sf = 120 yüz → 4 ₺', k.ok && k.miktar === 120 && k.birimFiyat === 400 && k.toplam === 48000, k);
  t('kademe sınırı dahil: tam 100 yüz 4 ₺', fiyatHesapla(A4, { adet: 1, sayfa: 100 }).birimFiyat === 400);
  t('99 yüz hâlâ 5 ₺', fiyatHesapla(A4, { adet: 1, sayfa: 99 }).birimFiyat === 500);
  const c = fiyatHesapla(A4, { adet: 1, sayfa: 10, secimler: { yuz: 'cift' } });
  t('CARPAN: çift yüz ×0,9 → 45 ₺', c.ok && c.toplam === 4500, c);
  t('varsayılan seçimler sonuçta görünüyor (tek yüz, ciltsiz)', JSON.stringify(r.secilenler.map((s) => s.kod)) === '["tek","yok"]', r.secilenler);
}

// ── CİLT ARALIĞI, YAPRAK, SABİT EK ──────────────────────────────────────
{
  const s = fiyatHesapla(A4, { adet: 2, sayfa: 40, secimler: { cilt: 'spiral' } });
  t('★ cilt nüsha başı, kalınlığa göre: 40 yaprak → 30 ₺ × 2 nüsha', s.ok && s.dokum.find((d) => d.tur === 'SECENEK')?.tutar === 6000, s.dokum);
  const s2 = fiyatHesapla(A4, { adet: 1, sayfa: 160, secimler: { cilt: 'spiral', yuz: 'cift' } });
  t('★ çift yüzde kalınlık yarıya iner: 160 sf çift yüz = 80 yaprak → 45 ₺', s2.dokum.find((d) => d.ad.startsWith('Cilt'))?.tutar === 4500, s2.dokum);
  const s3 = fiyatHesapla(A4, { adet: 1, sayfa: 300, secimler: { cilt: 'spiral' } });
  t('en büyük aralığı aşan kalınlık en büyük aralığın fiyatını alır', s3.dokum.find((d) => d.ad.startsWith('Cilt'))?.tutar === 4500);
  const l = fiyatHesapla(A4, { adet: 3, sayfa: 4, secimler: { lam: 'evet', yuz: 'cift' } });
  t('★ laminasyon yaprak başı: 4 sf çift yüz = 2 yaprak × 3 nüsha × 10 ₺', l.dokum.find((d) => d.ad.startsWith('Laminasyon'))?.tutar === 6000, l.dokum);
  const a = fiyatHesapla(A4, { adet: 1, sayfa: 10, secimler: { acil: 'evet' } });
  t('SABIT ek işe bir kez eklenir', a.toplam === 5000 + 5000 && fiyatHesapla(A4, { adet: 5, sayfa: 10, secimler: { acil: 'evet' } }).dokum.find((d) => d.ad.startsWith('Acil')).tutar === 5000);
}

// ── ADET, ALAN, SABİT ───────────────────────────────────────────────────
{
  const rollup = urunTanimi({ ad: 'Roll-up', fiyatModeli: 'ADET', kademeler: [{ min: 1, fiyat: 150000 }, { min: 5, fiyat: 130000 }], secenekler: [] });
  t('ADET: 2 roll-up', fiyatHesapla(rollup, { adet: 2 }).toplam === 300000);
  t('ADET kademesi: 5 adet ve üstü', fiyatHesapla(rollup, { adet: 5 }).toplam === 650000);

  const poster = urunTanimi({
    ad: 'Poster', fiyatModeli: 'ALAN', minTutar: 15000, kademeler: [{ min: 1, fiyat: 30000 }, { min: 5, fiyat: 25000 }],
    secenekler: [{ kod: 'k', ad: 'Kuşgözü', zorunlu: false, degerler: [{ kod: 'dort', ad: '4 köşe', tur: 'BIRIM', taban: 'NUSHA', deger: 2000 }] }],
  });
  const p1 = fiyatHesapla(poster, { adet: 1, enCm: 85, boyCm: 200 });
  t('★ ALAN: 85×200 cm = 1,70 m² × 300 ₺ = 510 ₺', p1.ok && p1.miktar === 1.7 && p1.toplam === 51000, p1);
  const p2 = fiyatHesapla(poster, { adet: 1, enCm: 30, boyCm: 40 });
  t('★ asgari tutar: 0,12 m² = 36 ₺ → 150 ₺, dökümde görünüyor', p2.toplam === 15000 && p2.asgariUygulandi && p2.dokum.some((d) => d.tur === 'ASGARI' && d.tutar === 11400), p2);
  t('ALAN kademesi toplam m²ye göre (3 × 1,70 = 5,1 m²)', fiyatHesapla(poster, { adet: 3, enCm: 85, boyCm: 200 }).birimFiyat === 25000);
  t('kuşgözü nüsha başı', fiyatHesapla(poster, { adet: 2, enCm: 100, boyCm: 100, secimler: { k: 'dort' } }).dokum.find((d) => d.tur === 'SECENEK').tutar === 4000);
  t('ölçüsüz ALAN hata', fiyatHesapla(poster, { adet: 1 }).kod === 'OLCU_GEREKLI' && fiyatHesapla(poster, { adet: 1, enCm: 0, boyCm: 10 }).kod === 'OLCU_GEREKLI');

  const kase = urunTanimi({ ad: 'Kaşe', fiyatModeli: 'SABIT', kademeler: [{ min: 1, fiyat: 45000 }, { min: 10, fiyat: 1 }], secenekler: [] });
  t('SABIT: kademe yok, adet başı tek fiyat', fiyatHesapla(kase, { adet: 10 }).toplam === 450000);
}

// ── KDV VE YUVARLAMA ────────────────────────────────────────────────────
{
  const r = fiyatHesapla(A4, { adet: 1, sayfa: 10 });
  t('★ KDV dahil: 50 ₺ = 41,67 + 8,33', r.kdvHaric === 4167 && r.kdv === 833 && r.kdvHaric + r.kdv === r.toplam, r);
  const haric = urunTanimi({ ad: 'X', fiyatModeli: 'ADET', kdvDahil: false, kdvOrani: 20, kademeler: [{ min: 1, fiyat: 1001 }] });
  const h = fiyatHesapla(haric, { adet: 1 });
  t('★ KDV hariç girilmiş: 10,01 + 2,00 = 12,01, ara toplam kaymıyor', h.kdvHaric === 1001 && h.kdv === 200 && h.toplam === 1201, h);
  const yuv = urunTanimi({ ad: 'Y', fiyatModeli: 'SAYFA', yuvarlama: 100, kademeler: [{ min: 1, fiyat: 75 }] });
  const y = fiyatHesapla(yuv, { adet: 1, sayfa: 3 });
  t('★ yuvarlama tam liraya YUKARI: 2,25 → 3,00, dökümde görünüyor', y.toplam === 300 && y.dokum.some((d) => d.tur === 'YUVARLAMA' && d.tutar === 75), y);
  t('zaten katıysa yuvarlama satırı yok', !fiyatHesapla(yuv, { adet: 1, sayfa: 4 }).dokum.some((d) => d.tur === 'YUVARLAMA'));
  // Rastgele 2000 iş: döküm toplamı her zaman toplam, KDV iki parçası toplamı veriyor.
  let tutarsiz = null;
  for (let i = 0; i < 2000 && !tutarsiz; i++) {
    const u = urunTanimi({ ad: 'R', fiyatModeli: 'SAYFA', kdvOrani: [0, 1, 10, 20][i % 4], kdvDahil: i % 2 === 0, yuvarlama: [0, 50, 100][i % 3], minTutar: i % 5 ? 0 : 2500, kademeler: [{ min: 1, fiyat: 37 + (i % 13) }, { min: 50, fiyat: 29 }] });
    const r2 = fiyatHesapla(u, { adet: 1 + (i % 7), sayfa: 1 + (i % 97), secimler: {} });
    // KDV dahil fiyatta döküm toplamı = toplam; hariçte döküm + KDV = toplam.
    const dokum = r2.dokum.reduce((a, d) => a + d.tutar, 0);
    const dokumTutuyor = u.kdvDahil ? dokum === r2.toplam : dokum + r2.kdv >= r2.toplam - 1 && dokum <= r2.toplam;
    if (!Number.isInteger(r2.toplam) || r2.kdvHaric + r2.kdv !== r2.toplam || !dokumTutuyor || r2.kdv < 0) tutarsiz = { i, r2 };
  }
  t('★ 2000 rastgele iş: kuruş tam sayı, KDV parçaları ve döküm toplamı tutuyor', tutarsiz === null, tutarsiz);
}

// ── HATALAR ─────────────────────────────────────────────────────────────
{
  t('adet geçersiz', ['0', 0, -1, 'abc', null, 2_000_000].every((a) => fiyatHesapla(A4, { adet: a, sayfa: 1 }).kod === 'ADET_GECERSIZ'));
  t('SAYFA modelinde sayfasız hata', fiyatHesapla(A4, { adet: 1 }).kod === 'SAYFA_GEREKLI');
  t('bilinmeyen seçim reddediliyor (sessizce varsayılana dönmüyor)', fiyatHesapla(A4, { adet: 1, sayfa: 1, secimler: { yuz: 'uc' } }).kod === 'SECENEK_GECERSIZ');
  const zorunlu = urunTanimi({ ad: 'Z', fiyatModeli: 'ADET', kademeler: [{ min: 1, fiyat: 100 }], secenekler: [{ kod: 'e', ad: 'Ebat', zorunlu: true, degerler: [{ kod: 'a', ad: 'A', tur: 'CARPAN', deger: 1 }] }] });
  const z = fiyatHesapla(zorunlu, { adet: 1 });
  t('zorunlu grupta seçim ve varsayılan yoksa hata, grup adıyla', z.kod === 'SECENEK_EKSIK' && z.grup === 'e', z);
}

// ── FİYATSIZ ÜRÜN ───────────────────────────────────────────────────────
{
  t('fiyatlı ürün', fiyatliMi(A4));
  const fiyatsiz = urunTanimi({ ad: 'F', fiyatModeli: 'ADET', kademeler: [{ min: 1, fiyat: 0 }] });
  t('★ fiyatsız ürün fiyatlanmıyor (0 ₺ iş açılmıyor)', !fiyatliMi(fiyatsiz) && fiyatHesapla(fiyatsiz, { adet: 1 }).kod === 'FIYAT_YOK');
  t('kademesiz ürün fiyatsız', !fiyatliMi(urunTanimi({ ad: 'B', fiyatModeli: 'ADET', kademeler: [] })));
  const kismi = urunTanimi({ ad: 'K', fiyatModeli: 'SAYFA', kademeler: [{ min: 1, fiyat: 100 }, { min: 100, fiyat: 0 }] });
  t('bir kademesi boş ürün fiyatsız (100 sayfadan sonra bedava olmasın)', !fiyatliMi(kismi));
  const renk = urunTanimi({ ad: 'P', fiyatModeli: 'ADET', kademeler: [{ min: 1, fiyat: 100 }], secenekler: [{ kod: 'r', ad: 'Renk', zorunlu: true, degerler: [{ kod: 'sb', ad: 'S/B', tur: 'CARPAN', deger: 1, varsayilan: true }, { kod: 'renkli', ad: 'Renkli', tur: 'BIRIM', deger: 0 }] }] });
  t('★ eki girilmemiş ürün fiyatsız: renkli siyah-beyaz fiyatına gitmez', !fiyatliMi(renk) && JSON.stringify(eksikFiyatlar(renk)) === '["Renk: Renkli"]', eksikFiyatlar(renk));
  const aralik = urunTanimi({ ad: 'C', fiyatModeli: 'SAYFA', kademeler: [{ min: 1, fiyat: 100 }], secenekler: [{ kod: 'c', ad: 'Cilt', zorunlu: false, degerler: [{ kod: 's', ad: 'Spiral', tur: 'BIRIM', taban: 'NUSHA', deger: 0, araliklar: [{ max: 50, deger: 3000 }, { max: 100, deger: 0 }] }] }] });
  t('cilt aralıklarından biri boşsa eksik', eksikFiyatlar(aralik).length === 1);
}

// ── NORMALLEŞTİRME ──────────────────────────────────────────────────────
{
  const u = urunTanimi({
    ad: '  Bozuk  ', fiyatModeli: 'YOK', kdvOrani: 'abc', yuvarlama: -5, minTutar: '1500',
    kademeler: [{ min: 100, fiyat: '400' }, { min: 5, fiyat: 500 }, { min: 100, fiyat: 350 }, 'çöp', { min: 'x', fiyat: -3 }],
    secenekler: [{ kod: 'a', ad: 'A', degerler: [{ kod: 'x', tur: 'CARPAN', deger: -1, varsayilan: true }, { kod: 'y', tur: 'BIRIM', deger: 10, varsayilan: true }, { kod: 'x', tur: 'SABIT', deger: 1 }] },
      { kod: 'a', ad: 'tekrar', degerler: [{ kod: 'z', deger: 1 }] }, { kod: 'bos', degerler: [] }, null],
  });
  t('bilinmeyen model ADET, bozuk KDV %20, eksi yuvarlama 0, metin tutar sayı', u.fiyatModeli === 'ADET' && u.kdvOrani === 20 && u.yuvarlama === 0 && u.minTutar === 1500 && u.ad === 'Bozuk', u);
  t('★ kademeler sıralı, tekil (sonraki geçerli), ilki 1\'den başlıyor', JSON.stringify(u.kademeler.map((k) => [k.min, k.fiyat])) === '[[1,500],[100,350]]', u.kademeler);
  t('miktarı okunmayan kademe satırı atılıyor, fiyatı okunmayan 0 kalıp ürünü fiyatsız yapıyor', !fiyatliMi(urunTanimi({ kademeler: [{ min: 1, fiyat: 'yok' }] })) && urunTanimi({ kademeler: [{ min: 'x', fiyat: 5 }] }).kademeler.length === 0);
  t('geçersiz çarpan 1, tekrarlı değer ve grup atılıyor, boş grup düşüyor', u.secenekler.length === 1 && u.secenekler[0].degerler.length === 2 && u.secenekler[0].degerler[0].deger === 1);
  t('tek varsayılan kalıyor', u.secenekler[0].degerler.filter((d) => d.varsayilan).length === 1);
  t('Json dizi değilse boş liste', urunTanimi({ kademeler: '{"a":1}', secenekler: 5 }).kademeler.length === 0);
  t('kademeBul miktar altında ilk kademeye düşüyor', kademeBul([{ min: 1, fiyat: 5 }, { min: 10, fiyat: 4 }], 0.5).fiyat === 5);
}

// ── ÖZET ────────────────────────────────────────────────────────────────
{
  const g2 = { adet: 2, sayfa: 120, secimler: { cilt: 'spiral' } };
  const r = fiyatHesapla(A4, g2);
  t('★ özet: "A4 Renkli · 2 nüsha · 120 sf · Tek yüz · Spiral"', kalemOzeti(A4, g2, r.secilenler) === 'A4 Renkli · 2 nüsha · 120 sf · Tek yüz · Spiral', kalemOzeti(A4, g2, r.secilenler));
  t('İngilizce özet', kalemOzeti(A4, g2, r.secilenler, 'en').includes('2 copies · 120 pp'));
}

// ── ŞABLONLAR ───────────────────────────────────────────────────────────
{
  const { BASKI_SABLONLARI, sablonSatirlari } = S;
  const kodlar = BASKI_SABLONLARI.map((s) => s.kod);
  t('şablon kodları tekil', new Set(kodlar).size === kodlar.length);
  t('★ plandaki şablonlar var (fotokopi, plan, poster, roll-up, canvas, cilt, laminasyon, kaşe, tarama)',
    ['fotokopi-a4-sb', 'fotokopi-a4-renkli', 'fotokopi-a3-sb', 'fotokopi-a3-renkli', 'plan-a2', 'plan-a1', 'plan-a0', 'poster', 'rollup', 'canvas', 'cilt-spiral', 'cilt-termal', 'laminasyon', 'kase', 'tarama'].every((k) => kodlar.includes(k)));
  const tanimlar = BASKI_SABLONLARI.map((s) => urunTanimi({ ...s, ad: s.ad.tr }));
  t('★ hiçbir şablon fiyatlı gelmiyor (yanlış varsayılan fiyat müşteriye gitmesin)', tanimlar.every((u) => !fiyatliMi(u)));
  t('şablonlar normalleştirmeden olduğu gibi geçiyor (bozuk yapı yok)',
    BASKI_SABLONLARI.every((s, i) => s.secenekler.length === tanimlar[i].secenekler.length && s.kademeler.length === tanimlar[i].kademeler.length));
  // Fiyat girilince her şablon hesaplanabiliyor olmalı.
  const doldur = (s) => ({
    ...s, ad: s.ad.tr,
    kademeler: s.kademeler.map((k, i) => ({ ...k, fiyat: 1000 - i * 100 })),
    secenekler: s.secenekler.map((gr) => ({ ...gr, degerler: gr.degerler.map((d) => d.tur === 'CARPAN' ? d : { ...d, deger: 500, araliklar: d.araliklar?.map((a) => ({ ...a, deger: 700 })) }) })),
  });
  const hatali = BASKI_SABLONLARI.filter((s) => {
    const u = urunTanimi(doldur(s));
    const r = fiyatHesapla(u, { adet: 2, sayfa: 10, enCm: 50, boyCm: 70 });
    return !fiyatliMi(u) || !r.ok || r.toplam <= 0;
  }).map((s) => s.kod);
  t('★ fiyatı girilen her şablon varsayılanlarıyla hesaplanıyor', hatali.length === 0, hatali);
  const tr = sablonSatirlari('tr');
  t('satırlar Türkçe adla, sıralı', tr[0].ad === 'Fotokopi A4 siyah-beyaz' && tr.every((x, i) => i === 0 || x.sira > tr[i - 1].sira));
  t('İngilizce kiracıda İngilizce ad', sablonSatirlari('en')[0].ad === 'Copy A4 black and white');
  t('★ ikinci kurulum çoğaltmıyor: mevcut kodlar atlanıyor', sablonSatirlari('tr', kodlar).length === 0 && sablonSatirlari('tr', ['poster']).length === kodlar.length - 1);
}

// ── KAYNAK DENETİMİ ─────────────────────────────────────────────────────
{
  const oku = (y) => readFileSync(join(KOK, y), 'utf8');
  const sema = oku('prisma/schema.prisma');
  t('★ BaskiUrunu şemada, kiracıya bağlı, şablon kodu kiracı başına tekil', /model BaskiUrunu \{/.test(sema) && /@@unique\(\[tenantId, sablonKodu\]\)/.test(sema) && /baskiUrunleri\s+BaskiUrunu\[\]/.test(sema));
  const tm = oku('src/lib/tenant-manager.ts');
  t('★ yalnız MATBAA açılışında şablon yazılıyor', /tur === 'MATBAA' \? \{ baskiUrunleri: \{ create: sablonSatirlari\(/.test(tm));
  const put = oku('src/app/api/super-admin/tenants/[id]/route.ts');
  t('matbaaya çevrilen işletmeye eksik şablonlar ekleniyor', /hesapTuru === 'MATBAA' && oncesi\?\.hesapTuru !== 'MATBAA'\) await sablonlariKur\(id\)/.test(put));
  t('kurulum çoğaltmıyor (skipDuplicates)', /skipDuplicates: true/.test(oku('src/lib/baski-urun.ts')));
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
