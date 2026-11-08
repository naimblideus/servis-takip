// EKRAN İÇİ EĞİTİM VİDEOLARI — harita, dosyalar ve yerleşimler
// Çalıştır:  node scripts/test-egitim-videolari.mjs   (sunucu ve veritabanı gerekmez)
//
// NEDEN BU TEST
// "▶ 1 dk" düğmesi videoyu bölümün saniyesinden açar (lib/egitim-videolari.ts).
// Saniye yanlışsa düğme başka bir bölümü oynatır; dosya yoksa ya da bölüm
// videonun dışındaysa pencere boş açılır. Kimse fark etmez, çünkü yeni bayi
// "bu video ilgisiz" deyip kapatır. Kilitlenenler:
//   · her harita girdisinin dosyası var; bas < bit ve ikisi de dosyanın süresi içinde;
//   · her bölümün başında anahtar kare var (atlama anında olsun);
//   · dosyalar H.264, akışa hazır (moov önde), 720p sınıfında, dakikası ~1 MB;
//   · her yerleşim kodu haritada var, haritada kullanılmayan girdi yok;
//   · başlıkların TR ve EN karşılığı var;
//   · teknisyenin adımlarında yalnız teknisyen klibi var (para ekranı klibi yok);
//   · öğrendikten sonra her seferinde çıkmaz: sayfa düğmeleri kişinin ilk 45
//     gününde ve izlenene kadar; ilk giriş adımı ve Yardım kalıcı; Yardım'daki
//     liste bütün klipleri taşır (45 günden sonra hiçbir klip ulaşılamaz kalmasın).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { derle, KOK } from './_derle.mjs';

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const { ice, temizle } = derle({
  girisler: ['src/lib/egitim-videolari.ts', 'src/lib/rehber-rol.ts', 'src/lib/i18n/tr.ts', 'src/lib/i18n/en.ts'],
  onEk: 'st-egitim-',
});
const ev = await ice('lib/egitim-videolari');
const rr = await ice('lib/rehber-rol');
const { tr } = await ice('lib/i18n/tr');
const { en } = await ice('lib/i18n/en');
const { EGITIM_DOSYALARI: DOSYALAR, EGITIM_VIDEOLARI: VIDEOLAR } = ev;

// ── MP4 okuyucu: yalnız gereken kutular (ffprobe'a bağımlı olmasın) ─────────
function kutular(b, bas, son) {
  const out = [];
  let i = bas;
  while (i + 8 <= son) {
    let boy = b.readUInt32BE(i);
    const tur = b.toString('latin1', i + 4, i + 8);
    let bas2 = i + 8;
    if (boy === 1) { boy = Number(b.readBigUInt64BE(i + 8)); bas2 = i + 16; }
    else if (boy === 0) boy = son - i;
    if (boy < 8) break;
    out.push({ tur, bas: bas2, son: Math.min(i + boy, son) });
    i += boy;
  }
  return out;
}
const bul = (b, k, tur) => kutular(b, k.bas, k.son).find((x) => x.tur === tur);
function mp4Oku(yol) {
  const b = readFileSync(yol);
  const ust = kutular(b, 0, b.length);
  const moov = ust.find((x) => x.tur === 'moov');
  const sira = ust.map((x) => x.tur);
  const mvhd = bul(b, moov, 'mvhd');
  const v = b[mvhd.bas];
  const zo = v === 1 ? 20 : 12; // timescale konumu
  const olcek = b.readUInt32BE(mvhd.bas + zo);
  const sure = (v === 1 ? Number(b.readBigUInt64BE(mvhd.bas + zo + 4)) : b.readUInt32BE(mvhd.bas + zo + 4)) / olcek;
  let video = null;
  for (const trak of kutular(b, moov.bas, moov.son).filter((x) => x.tur === 'trak')) {
    const mdia = bul(b, trak, 'mdia');
    const hdlr = bul(b, mdia, 'hdlr');
    if (b.toString('latin1', hdlr.bas + 8, hdlr.bas + 12) !== 'vide') continue;
    const tkhd = bul(b, trak, 'tkhd');
    const tv = b[tkhd.bas];
    const wo = tkhd.bas + (tv === 1 ? 88 : 76);
    const en_ = b.readUInt32BE(wo) / 65536, boy = b.readUInt32BE(wo + 4) / 65536;
    const mdhd = bul(b, mdia, 'mdhd');
    const mv = b[mdhd.bas];
    const ts = b.readUInt32BE(mdhd.bas + (mv === 1 ? 20 : 12));
    const stbl = bul(b, bul(b, mdia, 'minf'), 'stbl');
    const stsd = bul(b, stbl, 'stsd');
    const kodek = b.toString('latin1', stsd.bas + 12, stsd.bas + 16);
    // Anahtar karelerin zamanı: stss (örnek no, 1'den) + stts (örnek süreleri).
    const stts = bul(b, stbl, 'stts');
    const sureler = [];
    for (let i = 0, n = b.readUInt32BE(stts.bas + 4); i < n; i++) {
      const adet = b.readUInt32BE(stts.bas + 8 + i * 8), delta = b.readUInt32BE(stts.bas + 12 + i * 8);
      for (let j = 0; j < adet; j++) sureler.push(delta);
    }
    const anlar = [0];
    for (const d of sureler) anlar.push(anlar[anlar.length - 1] + d);
    const stss = bul(b, stbl, 'stss');
    const anahtar = [];
    if (stss) for (let i = 0, n = b.readUInt32BE(stss.bas + 4); i < n; i++) anahtar.push(anlar[b.readUInt32BE(stss.bas + 8 + i * 4) - 1] / ts);
    video = { en: en_, boy, kodek, anahtar };
  }
  return { sure, sira, video, bayt: b.length };
}

console.log('\n★ DOSYALAR VAR VE OYNATILABİLİR\n');
const olcu = {};
let toplamBayt = 0;
for (const [ad, d] of Object.entries(DOSYALAR)) {
  const yol = join(KOK, 'public', d.yol);
  const var_ = d.yol.startsWith('/egitim/') && existsSync(yol);
  t(`★ ${ad}: ${d.yol} var`, var_);
  if (!var_) continue;
  const m = mp4Oku(yol);
  olcu[ad] = m;
  toplamBayt += m.bayt;
  t(`${ad}: H.264 (avc1)`, m.video?.kodek === 'avc1', m.video?.kodek);
  t(`${ad}: akışa hazır — moov, mdat'tan önce (preload="none" ile anında başlar)`, m.sira.indexOf('moov') < m.sira.indexOf('mdat'), m.sira);
  const uzun = Math.max(m.video.en, m.video.boy), kisa = Math.min(m.video.en, m.video.boy);
  t(`${ad}: 720p sınıfı (${m.video.en}×${m.video.boy})`, uzun === 1280 && kisa === 720, [m.video.en, m.video.boy]);
  t(`${ad}: haritadaki süre dosyanınki (${d.sure} ≈ ${m.sure.toFixed(2)} sn)`, Math.abs(m.sure - d.sure) < 0.15, m.sure);
  const mbDk = m.bayt / 1e6 / (m.sure / 60);
  t(`${ad}: dakikası en çok 1,3 MB (${mbDk.toFixed(2)} MB/dk)`, mbDk <= 1.3, mbDk);
  t(`${ad}: dil tanımlı`, d.dil === 'tr' || d.dil === 'en', d.dil);
}
// Depo herkese açık ve her push canlıya gidiyor: klasör sessizce şişmesin.
const klasor = join(KOK, 'public', 'egitim');
const fazla = existsSync(klasor) ? readdirSync(klasor).filter((f) => !Object.values(DOSYALAR).some((d) => d.yol === `/egitim/${f}`)) : [];
t('public/egitim içinde haritada olmayan dosya yok', fazla.length === 0, fazla);
const klasorBayt = existsSync(klasor) ? readdirSync(klasor).reduce((s, f) => s + statSync(join(klasor, f)).size, 0) : 0;
t(`★ toplam boyut en çok 30 MB (${(klasorBayt / 1e6).toFixed(1)} MB)`, klasorBayt <= 30e6, klasorBayt);

console.log('\n★ HER BÖLÜM DOSYANIN İÇİNDE, BAŞINDA ANAHTAR KARE\n');
for (const [kod, v] of Object.entries(VIDEOLAR)) {
  const d = DOSYALAR[v.dosya];
  t(`${kod}: dosya anahtarı (${v.dosya}) tanımlı`, !!d);
  if (!d) continue;
  t(`★ ${kod}: 0 ≤ bas < bit ≤ süre (${v.bas} → ${v.bit} / ${d.sure})`, v.bas >= 0 && v.bas < v.bit && v.bit <= d.sure + 0.01, [v.bas, v.bit, d.sure]);
  t(`${kod}: en az 8 sn (bölüm, kırpıntı değil)`, v.bit - v.bas >= 8, v.bit - v.bas);
  t(`${kod}: kaynak "${ev.egitimKaynagi(kod)}"`, ev.egitimKaynagi(kod) === `${d.yol}#t=${v.bas},${v.bit}`);
  const dk = ev.egitimDakika(kod);
  t(`${kod}: düğmede ${dk} dk (en az 1, gerçek süreye yakın)`, dk >= 1 && Math.abs(dk * 60 - (v.bit - v.bas)) <= 45, [dk, v.bit - v.bas]);
  const m = olcu[v.dosya];
  if (m) {
    const yakin = m.video.anahtar.some((a) => Math.abs(a - v.bas) <= 0.2);
    t(`${kod}: ${v.bas} sn'de anahtar kare var`, yakin, m.video.anahtar.filter((a) => Math.abs(a - v.bas) < 6).map((a) => +a.toFixed(2)));
  }
  t(`${kod}: başlık TR ve EN sözlükte (egitim.video.${v.baslik})`,
    typeof tr.egitim.video[v.baslik] === 'string' && tr.egitim.video[v.baslik].length > 0
    && typeof en.egitim.video[v.baslik] === 'string' && en.egitim.video[v.baslik].length > 0);
}
t('egitimKoduMu: bilinmeyen kod reddedilir', ev.egitimKoduMu('servis-fis') && !ev.egitimKoduMu('yok-boyle') && !ev.egitimKoduMu('toString'));

console.log('\n★ YERLEŞİMLER\n');
// Kaynakta geçen her kod: <EgitimVideosu kod="…">, kod={… '…' …} ve adım/bölüm tanımındaki video: '…'.
const kaynaklar = [];
const gez = (d) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) gez(p);
    else if (/\.(tsx|ts)$/.test(e.name)) kaynaklar.push(p);
  }
};
gez(join(KOK, 'src'));
const kullanilan = new Map(); // kod → dosyalar
const ekle = (kod, f) => { const k = f.replace(/\\/g, '/').split('/src/')[1]; kullanilan.set(kod, [...(kullanilan.get(kod) || []), k]); };
const bilesenli = new Set();
for (const f of kaynaklar) {
  if (f.endsWith('egitim-videolari.ts')) continue;
  const s = readFileSync(f, 'utf8');
  if (s.includes('<EgitimVideosu')) bilesenli.add(f.replace(/\\/g, '/').split('/src/')[1]);
  for (const m of s.matchAll(/<EgitimVideosu\b[^>]*?\bkod=(?:"([^"]+)"|\{([^}]*)\})/g)) {
    if (m[1]) ekle(m[1], f);
    else for (const q of m[2].matchAll(/'([a-z][a-z0-9-]*)'/g)) ekle(q[1], f);
  }
  for (const m of s.matchAll(/\bvideo:\s*'([a-z][a-z0-9-]*)'/g)) ekle(m[1], f);
}
for (const v of Object.values(rr.ROL_TANITIM_VIDEOSU)) if (v) ekle(v, 'src/lib/rehber-rol.ts');
const bilinmeyen = [...kullanilan.keys()].filter((k) => !ev.egitimKoduMu(k));
t(`★ her yerleşim kodu haritada var (${kullanilan.size} kod)`, bilinmeyen.length === 0, bilinmeyen.map((k) => `${k} · ${kullanilan.get(k)}`));
const olu = Object.keys(VIDEOLAR).filter((k) => !kullanilan.has(k));
t('haritada hiçbir ekranda kullanılmayan girdi yok', olu.length === 0, olu);
// Plan 5. madde: ilk giriş, /yardim, /import, /sayac-turu, faturalar (taslaklar), /magaza.
for (const yer of ['components/Onboarding.tsx', 'app/(dashboard)/yardim/page.tsx', 'app/(dashboard)/import/page.tsx',
  'app/(dashboard)/sayac-turu/page.tsx', 'app/(dashboard)/invoices/page.tsx', 'app/(dashboard)/magaza/page.tsx',
  'app/(dashboard)/magaza/ayarlar/MagazaAyarlari.tsx']) {
  t(`★ ${yer}: düğme yerleşmiş`, bilesenli.has(yer));
}

console.log('\n★ İLK GİRİŞ ADIMLARI\n');
for (const rol of ['TECHNICIAN', 'FRONT_DESK']) {
  for (const a of rr.ROL_ADIMLARI[rol]) {
    if (a.video) t(`${rol} · ${a.key}: klip haritada (${a.video})`, ev.egitimKoduMu(a.video));
  }
}
const tekVideolar = rr.ROL_ADIMLARI.TECHNICIAN.map((a) => a.video).filter(Boolean);
t('★ teknisyen adımlarında yalnız teknisyen klibi (fatura, tahsilat klibi yok)',
  tekVideolar.length > 0 && tekVideolar.every((k) => VIDEOLAR[k].dosya === 'teknisyen'), tekVideolar);
t('teknisyen Sayaç gir adımı Sayaç Turu klibini açar', rr.ROL_ADIMLARI.TECHNICIAN.find((a) => a.key === 'sayac')?.video === 'teknisyen-sayac');
t('teknisyen karşılama ekranında bütün akış', rr.ROL_TANITIM_VIDEOSU.TECHNICIAN === 'teknisyen');
const onb = readFileSync(join(KOK, 'src/components/Onboarding.tsx'), 'utf8');
t('ekip adımı klibi izlenince tamam sayılır (onIzlendi → adimiIsaretle)', /onIzlendi=\{ekip \? \(\) => adimiIsaretle\(c\.key\)/.test(onb));

console.log('\n★ OYNATICI\n');
const bil = readFileSync(join(KOK, 'src/components/EgitimVideosu.tsx'), 'utf8');
t('video yalnız oynatılınca iner (preload="none")', /preload="none"/.test(bil));
t('telefonda tam ekrana zorlamaz (playsInline) ve denetimler açık (controls)', /playsInline/.test(bil) && /\bcontrols\b/.test(bil));
t('kaynak bölümlü (#t=bas,bit, egitimKaynagi)', /src=\{egitimKaynagi\(kod\)\}/.test(bil));
t('★ dosya yoksa düğme yok (HEAD ile sorulur, cevaba kadar çizilmez)', /method: 'HEAD'/.test(bil) && /!var_ \|\| !izinli\) return null/.test(bil));
t('arayüz dili videonunkiyle aynı değilse düğme yok', /dosya\.dil === dil/.test(bil));
t('pencere body\'ye taşınır (alt sekme çubuğu üstüne binmesin)', /createPortal\(/.test(bil));
t('Esc kapatır', /e\.key === 'Escape'/.test(bil));

console.log('\n★ ÖĞRENDİKTEN SONRA HER SEFERİNDE ÇIKMAZ\n');
const GUN = 86_400_000, simdi = Date.UTC(2026, 10, 8, 12);
t(`★ sayfa düğmesinin süresi ilk ay sonunu kapsar ama sonsuz değil (${ev.EGITIM_ACIK_GUN} gün)`, ev.EGITIM_ACIK_GUN >= 35 && ev.EGITIM_ACIK_GUN <= 90, ev.EGITIM_ACIK_GUN);
t('yeni açılan hesap öğrenme döneminde', ev.egitimDonemindeMi(new Date(simdi), simdi) === true);
t('süre bitmeden bir an önce hâlâ dönemde', ev.egitimDonemindeMi(simdi - ev.EGITIM_ACIK_GUN * GUN + 60_000, simdi) === true);
t(`★ ${ev.EGITIM_ACIK_GUN}. gün dolunca dönem biter`, ev.egitimDonemindeMi(simdi - ev.EGITIM_ACIK_GUN * GUN, simdi) === false);
t('yıllardır kullanan kişi dönemde değil', ev.egitimDonemindeMi(new Date(simdi - 400 * GUN).toISOString(), simdi) === false);
t('tarih okunamazsa düğme kalır (gizlemek yerine göstermek)', ev.egitimDonemindeMi('bozuk', simdi) === true);
const ayni = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
t('izlenen klip listeye girer, başkası girmez', ayni(ev.izlenenlereEkle([], 'servis-fis'), ['servis-fis']), ev.izlenenlereEkle([], 'servis-fis'));
t('★ teknisyenin tam klibini izleyen iki parçasını da izlemiş sayılır',
  ayni(ev.izlenenlereEkle([], 'teknisyen'), ['teknisyen', 'teknisyen-is', 'teknisyen-sayac']), ev.izlenenlereEkle([], 'teknisyen'));
t('başka videonun klibi, saniyesi içine düşse de girmez',
  ev.izlenenlereEkle([], 'kiralik-sayac').every((k) => VIDEOLAR[k].dosya === 'kiralik'), ev.izlenenlereEkle([], 'kiralik-sayac'));
t('eski liste korunur, bilinmeyen kod atılır, tekrar yok',
  ayni(ev.izlenenlereEkle(['yok-boyle', 'servis-fis', 42, 'servis-fis'], 'kiralik-kar'), ['servis-fis', 'kiralik-kar']),
  ev.izlenenlereEkle(['yok-boyle', 'servis-fis', 42, 'servis-fis'], 'kiralik-kar'));

// Hangi düğme süreli, hangisi kalıcı: etiketin tamamına bakılır (=> içindeki > etiketi bölmesin).
const etiketler = (yol) => [...readFileSync(join(KOK, 'src', yol), 'utf8').matchAll(/<EgitimVideosu\b([\s\S]*?)\/>/g)].map((m) => m[1]);
for (const yer of ['components/Onboarding.tsx', 'app/(dashboard)/yardim/page.tsx', 'components/EgitimKutuphanesi.tsx']) {
  const e = etiketler(yer);
  t(`★ ${yer}: düğme kalıcı (herZaman, ${e.length} yer)`, e.length > 0 && e.every((x) => /\bherZaman\b/.test(x)), e);
}
for (const yer of ['app/(dashboard)/import/page.tsx', 'app/(dashboard)/sayac-turu/page.tsx', 'app/(dashboard)/invoices/page.tsx',
  'app/(dashboard)/magaza/page.tsx', 'app/(dashboard)/magaza/ayarlar/MagazaAyarlari.tsx']) {
  const e = etiketler(yer);
  t(`★ ${yer}: sayfa düğmesi süreli (herZaman yok, ${e.length} yer)`, e.length > 0 && e.every((x) => !/\bherZaman\b/.test(x)), e);
}

const kut = readFileSync(join(KOK, 'src/components/EgitimKutuphanesi.tsx'), 'utf8');
const yardim = readFileSync(join(KOK, 'src/app/(dashboard)/yardim/page.tsx'), 'utf8');
t('★ Yardım\'da bütün kliplerin listesi var', /<EgitimKutuphanesi\b/.test(yardim) && /import EgitimKutuphanesi from '@\/components\/EgitimKutuphanesi'/.test(yardim));
t('★ liste haritanın kendisinden kurulur (yeni klip kendiliğinden girer)', /Object\.keys\(EGITIM_VIDEOLARI\)/.test(kut) && /Object\.keys\(EGITIM_DOSYALARI\)/.test(kut));
t('listede klip adı yazar (baslikli)', /herZaman baslikli/.test(kut));
t('liste yalnız videonun dilindeki arayüzde ve dosyası olan grupla', /EGITIM_DOSYALARI\[d\]\.dil === dil/.test(kut) && /dosyaVarMi\(/.test(kut));
for (const d of Object.keys(DOSYALAR)) {
  t(`grup adı TR ve EN (${d})`, !!tr.egitim.kutuphane.grup[d] && !!en.egitim.kutuphane.grup[d]);
}
t('başlıklı düğme metni iki dilde de ad ve dakika taşır',
  ['{baslik}', '{n}'].every((y) => tr.egitim.baslikliDugme.includes(y) && en.egitim.baslikliDugme.includes(y)));
t('liste açıklaması gün sayısını sözlükten değil haritadan alır ({gun})',
  tr.egitim.kutuphane.alt.includes('{gun}') && en.egitim.kutuphane.alt.includes('{gun}') && /gun: EGITIM_ACIK_GUN/.test(kut));
t('ilk giriş karşılaması videoların yerini söyler (TR)', /video/i.test(tr.rehber.sihirbaz.hazir.kutuOrta), tr.rehber.sihirbaz.hazir.kutuOrta);

const UC = join(KOK, 'src/app/api/egitim/durum/route.ts');
const uc = existsSync(UC) ? readFileSync(UC, 'utf8') : '';
t('★ uç var: /api/egitim/durum', uc.length > 0);
t('oturumsuz istek 401 (OTURUM_BULUNAMADI)', /ucHatasi\('OTURUM_BULUNAMADI', 401\)/.test(uc));
t('kişi kendi bayisinde aranır (bayiSuzgeci)', /bayiSuzgeci\(session\)/.test(uc));
t('★ süre KİŞİNİN hesabından sayılır (createdAt → egitimDonemindeMi)', /egitimDonemindeMi\(user\.createdAt\)/.test(uc));
t('demo bayisinde düğmeler hep açık (gezen herkes yeni)', /tenant\?\.demo/.test(uc));
t('cevap tek alan: ogrenmede', /NextResponse\.json\(\{ ogrenmede \}\)/.test(uc));

t('★ bileşen sayfa düğmesi için ucu kişi başına bir kez sorar', /fetch\('\/api\/egitim\/durum'/.test(bil) && /donemler\.get\(kisi\)/.test(bil));
t('izlenenler kişiye özel anahtarla tarayıcıda', /nextus-egitim-izlenen:\$\{kisi\}/.test(bil));
t('★ sonuna kadar izlenen klip kaydedilir (izlenenlereEkle)', /izlendiYaz\(kisi, kod\)/.test(bil) && /izlenenlereEkle\(izlenenler\(kisi\), kod\)/.test(bil));
t('izlenmiş klibin sayfa düğmesi sorulmadan gizli', /izlenenler\(kisi\)\.includes\(kod\)\) return/.test(bil));
t('★ izlerken düğme kaybolmaz: izin yalnız ekrana gelirken verilir (setIzinliKod tek yerde)',
  (bil.match(/setIzinliKod\(/g) || []).length === 1, (bil.match(/setIzinliKod\(/g) || []).length);
t('kalıcı düğme süreye bakmaz (herZaman)', /const izinli = herZaman \|\|/.test(bil));

temizle();
console.log(`\n${gecti} geçti, ${kaldi} kaldı`);
process.exit(kaldi ? 1 : 0);
