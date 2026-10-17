'use client';

/**
 * CANLI OPERASYON PANOSU — operasyon odasındaki televizyon.
 *
 * Tıklanmak için değil UZAKTAN okunmak için: koyu zemin, büyük rakam, her
 * kutuda tek soru. 1920×1080'de tek ekrana sığar (kaydırma yok), telefonda
 * kutular alt alta dizilir.
 *
 * ── CANLILIK ─────────────────────────────────────────────────────────────
 * 15 saniyede bir /api/pano. Sekme görünmezken SORULMAZ (gece boyu kapalı
 * monitör sunucuyu yormasın); görünür olunca hemen sorulur. Bağlantı
 * koparsa son veri ekranda KALIR ve üstte "bağlantı yok · son veri 12:04"
 * yazar — boş ekran, eski veriden kötüdür; eski veriyi canlı gibi göstermek
 * de ondan kötüdür. "Son güncelleme" sunucunun verdiği andır, tarayıcının
 * saati değil: televizyonun saati yanlışsa bile göreli süreler doğru kalır.
 *
 * ── OTURUM ───────────────────────────────────────────────────────────────
 * Oturum 8 saatte biter; ekran görünürken 20 dakikada bir tazelenir. Yine de
 * düşerse pano son veriyi gösterip "yeniden giriş" der.
 *
 * Para yok: oda herkese açık (lib/canli-pano.ts).
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getSession } from 'next-auth/react';
import { useT, useDil } from '@/lib/i18n/client';
import { doldur, type Sozluk } from '@/lib/i18n/sozluk';
import { INTL_LOCALE } from '@/lib/bicim';
import Monogram from '@/components/Monogram';
import {
  ACIK_DURUMLAR, SAYAC_GEC_GUN, YOKLAMA_SN, bayatMi, goreliZaman, sureParcala,
  type AcikDurum, type PanoOlayi, type TeknisyenSatiri,
} from '@/lib/canli-pano';
import { TONER_KRITIK } from '@/lib/sayac-tarama';
import type { CanliPanoVerisi } from '@/lib/canli-pano-veri';

/** Televizyonda gösterilen en fazla teknisyen; fazlası "+N" diye yazılır, kesilmez. */
const TV_TEKNISYEN = 16;
/** Oturumun düşmemesi için tazeleme aralığı (oturum 8 saat). */
const OTURUM_TAZELE_MS = 20 * 60_000;

// Durum işaretleri: koyu zemin için doğrulanmış dört ton (dataviz denetimi:
// açıklık bandı, renk körlüğü ayrımı, 3:1 kontrast — dördü de geçti). Renk
// yalnız işarette; sayı ve etiket her zaman metin renginde.
const DURUM_RENGI: Record<AcikDurum, string> = {
  NEW: '#C98500', IN_SERVICE: '#3987E5', WAITING_FOR_PART: '#D95926', READY: '#199E70',
};
const RENK = {
  zemin: '#060D22', kutu: '#0B1533', cizgi: '#1B2C52', metin: '#F1F4F9', ikincil: '#A8B3C7', soluk: '#7D8BA6',
  kritik: '#E05555', kritikZemin: '#2A1020', uyari: '#E0A23A', uyariZemin: '#2A1E0C', canli: '#2FBF8A',
};

const CSS = `
.cp-kok{min-height:100vh;background:${RENK.zemin};color:${RENK.metin};padding:16px;display:flex;flex-direction:column;gap:12px;font-family:inherit}
.cp-kok *{box-sizing:border-box}
.cp-ust{display:flex;align-items:center;justify-content:space-between;gap:10px 16px;flex-wrap:wrap}
.cp-ust-sol{display:flex;align-items:center;gap:12px;min-width:0}
.cp-ust-sag{display:flex;align-items:center;gap:10px 14px;flex-wrap:wrap}
.cp-baslik{font-size:1.15rem;font-weight:800;letter-spacing:-.01em;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp-bayi{font-size:.85rem;color:${RENK.ikincil};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp-saat{font-size:1.6rem;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.cp-durum{display:inline-flex;align-items:center;gap:8px;font-size:.85rem;color:${RENK.ikincil};font-variant-numeric:tabular-nums}
.cp-nokta{width:10px;height:10px;border-radius:999px;flex-shrink:0}
.cp-dugme{display:inline-flex;align-items:center;gap:6px;background:transparent;color:${RENK.ikincil};border:1px solid ${RENK.cizgi};border-radius:10px;padding:8px 12px;font-size:.85rem;font-weight:600;cursor:pointer;text-decoration:none;min-height:40px}
.cp-dugme:hover{color:${RENK.metin};border-color:#33476F}
.cp-kpi{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.cp-kutu{background:${RENK.kutu};border:1px solid ${RENK.cizgi};border-radius:14px;padding:14px 16px;min-width:0}
.cp-acik{grid-column:1/-1}
.cp-etiket{font-size:.9rem;font-weight:600;color:${RENK.ikincil};margin:0;line-height:1.25}
.cp-alt{font-size:.8rem;color:${RENK.soluk};margin:4px 0 0;line-height:1.3}
.cp-buyuk{font-size:3.2rem;font-weight:800;line-height:1;letter-spacing:-.02em;margin:8px 0 0}
.cp-orta{font-size:2.4rem;font-weight:800;line-height:1;letter-spacing:-.02em;margin:8px 0 0}
.cp-serit{display:flex;height:10px;border-radius:999px;overflow:hidden;gap:2px;margin:12px 0 10px;background:${RENK.cizgi}}
.cp-kirilim{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 14px}
.cp-kirilim-kalem{display:flex;align-items:baseline;gap:8px;min-width:0}
.cp-kirilim-ad{font-size:.85rem;color:${RENK.ikincil};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp-kirilim-n{font-size:1.5rem;font-weight:800;margin-left:auto}
.cp-govde{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}
.cp-sag{display:grid;gap:12px;align-content:start;min-height:0}
.cp-bolum-baslik{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:0 0 10px}
.cp-bolum-baslik h2{font-size:1rem;font-weight:800;margin:0;color:${RENK.metin}}
.cp-tek-liste{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,22rem),1fr));gap:8px}
.cp-tek{display:flex;gap:10px;align-items:flex-start;background:#0E1A3A;border:1px solid ${RENK.cizgi};border-radius:12px;padding:10px 12px;min-width:0}
.cp-tek-ad{font-size:1rem;font-weight:700;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp-tek-is{font-size:.85rem;color:${RENK.ikincil};margin:2px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp-tek-sag{margin-left:auto;text-align:right;flex-shrink:0}
.cp-tek-sure{font-size:1rem;font-weight:800;white-space:nowrap}
.cp-tek-not{font-size:.75rem;color:${RENK.soluk};white-space:nowrap;margin-top:2px}
.cp-fazla-not{display:none}
.cp-cihaz{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.cp-olay{display:flex;gap:10px;align-items:baseline;padding:7px 0;border-top:1px solid ${RENK.cizgi};min-width:0}
.cp-olay:first-child{border-top:none}
.cp-olay-zaman{font-size:.8rem;color:${RENK.soluk};width:4.2rem;flex-shrink:0;font-variant-numeric:tabular-nums}
.cp-olay-metin{font-size:.9rem;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp-olay-tur{font-weight:700}
.cp-serit-uyari{border-radius:12px;padding:10px 14px;font-size:.9rem;font-weight:600}
@media (min-width:1024px){
  .cp-kok{height:100vh;overflow:hidden;padding:1.3vh 1.4vw;gap:1.3vh}
  .cp-baslik{font-size:clamp(1.2rem,1.4vw,2rem)}
  .cp-bayi{font-size:clamp(.85rem,.9vw,1.25rem)}
  .cp-saat{font-size:clamp(1.6rem,2.1vw,3rem)}
  .cp-durum,.cp-dugme{font-size:clamp(.85rem,.8vw,1.1rem)}
  .cp-kpi{grid-template-columns:2.3fr repeat(var(--kpi-n),minmax(0,1fr))}
  .cp-acik{grid-column:auto}
  .cp-kutu{padding:1.4vh 1.1vw;border-radius:16px}
  .cp-etiket{font-size:clamp(.9rem,.95vw,1.35rem)}
  .cp-alt{font-size:clamp(.78rem,.75vw,1.05rem)}
  .cp-buyuk{font-size:clamp(3rem,4.6vw,6.6rem)}
  .cp-orta{font-size:clamp(2.2rem,3.3vw,4.8rem)}
  .cp-kirilim{grid-template-columns:repeat(4,minmax(0,1fr))}
  .cp-kirilim-ad{font-size:clamp(.8rem,.8vw,1.15rem)}
  .cp-kirilim-n{font-size:clamp(1.4rem,1.8vw,2.6rem)}
  .cp-govde{flex:1;min-height:0;grid-template-columns:1.5fr 1fr}
  .cp-govde>.cp-kutu,.cp-sag>.cp-kutu{overflow:hidden}
  .cp-sag{grid-template-rows:auto auto minmax(0,1fr)}
  .cp-bolum-baslik h2{font-size:clamp(1rem,1.1vw,1.6rem)}
  .cp-tek-liste{grid-template-columns:repeat(2,minmax(0,1fr))}
  .cp-tek{padding:1vh .8vw}
  .cp-tek-ad{font-size:clamp(1rem,1.1vw,1.55rem)}
  .cp-tek-is{font-size:clamp(.85rem,.85vw,1.2rem)}
  .cp-tek-sure{font-size:clamp(1rem,1.15vw,1.6rem)}
  .cp-tek-not{font-size:clamp(.75rem,.72vw,1rem)}
  .cp-tek-fazla{display:none}
  .cp-fazla-not{display:block}
  .cp-olay{padding:.75vh 0}
  .cp-olay-zaman{font-size:clamp(.8rem,.78vw,1.1rem);width:5.2vw}
  .cp-olay-metin{font-size:clamp(.9rem,.9vw,1.25rem)}
}
`;

function saatYaz(an: number, dil: 'tr' | 'en', saniye = true): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[dil], {
    hour: '2-digit', minute: '2-digit', ...(saniye ? { second: '2-digit' } : {}), hour12: false,
  }).format(new Date(an));
}

function sureYaz(t: Sozluk, dakika: number): string {
  const { sa, dk } = sureParcala(dakika);
  if (sa === 0) return doldur(t.canliPano.sure.dk, { dk });
  if (dk === 0 || sa >= 10) return doldur(t.canliPano.sure.sa, { sa });
  return doldur(t.canliPano.sure.saDk, { sa, dk });
}

function goreliYaz(t: Sozluk, iso: string, simdi: number): string {
  const g = goreliZaman(new Date(iso), new Date(simdi));
  return doldur(t.canliPano.zaman[g.birim], { n: g.n });
}

/** Saniyeli saat — yalnız kendisi her saniye çizilir, pano değil. */
function Saat({ dil, fark }: { dil: 'tr' | 'en'; fark: number }) {
  const [an, setAn] = useState<number | null>(null);
  useEffect(() => {
    const yaz = () => setAn(Date.now() + fark);
    yaz();
    const z = setInterval(yaz, 1000);
    return () => clearInterval(z);
  }, [fark]);
  return <span className="cp-saat" suppressHydrationWarning>{an === null ? '' : saatYaz(an, dil, false)}</span>;
}

export default function CanliPanoSayfasi() {
  const t = useT();
  const { dil } = useDil();
  const p = t.canliPano;

  const [veri, setVeri] = useState<CanliPanoVerisi | null>(null);
  const [sonBasari, setSonBasari] = useState<number | null>(null);
  const [hata, setHata] = useState(false);
  const [oturumYok, setOturumYok] = useState(false);
  // Sunucu saati − tarayıcı saati. Göreli süreler sunucunun saatine göre.
  const [fark, setFark] = useState(0);
  const [simdi, setSimdi] = useState(() => Date.now());
  const [tamEkran, setTamEkran] = useState(false);
  const [tamEkranVar, setTamEkranVar] = useState(false);
  const [imlecGizli, setImlecGizli] = useState(false);

  // ── YOKLAMA ──────────────────────────────────────────────────────────
  useEffect(() => {
    let bitti = false;
    let zamanlayici: ReturnType<typeof setTimeout> | null = null;
    let suren: AbortController | null = null;

    const yokla = async () => {
      if (document.hidden) return;
      suren?.abort();
      const ac = new AbortController();
      suren = ac;
      const sinir = setTimeout(() => ac.abort(), 12_000);
      try {
        const r = await fetch('/api/pano', { cache: 'no-store', signal: ac.signal });
        if (r.status === 401 || r.status === 404) { if (!bitti) setOturumYok(true); return; }
        if (!r.ok) throw new Error(String(r.status));
        const d = (await r.json()) as CanliPanoVerisi;
        if (bitti) return;
        const an = Date.now();
        const sunucu = Date.parse(d.olusturuldu);
        setVeri(d);
        setHata(false);
        setOturumYok(false);
        setSonBasari(an);
        setSimdi(an);
        if (Number.isFinite(sunucu)) setFark(sunucu - an);
      } catch {
        if (!bitti) setHata(true);
      } finally {
        clearTimeout(sinir);
      }
    };
    const planla = () => {
      zamanlayici = setTimeout(async () => {
        await yokla();
        if (!bitti) planla();
      }, YOKLAMA_SN * 1000);
    };
    yokla().then(() => { if (!bitti) planla(); });
    const gorunurluk = () => { if (!document.hidden) yokla(); };
    document.addEventListener('visibilitychange', gorunurluk);
    return () => {
      bitti = true;
      if (zamanlayici) clearTimeout(zamanlayici);
      suren?.abort();
      document.removeEventListener('visibilitychange', gorunurluk);
    };
  }, []);

  // Göreli süreler ve bayatlık için yavaş tik (5 sn) — saniyeli saat ayrı bileşende.
  useEffect(() => {
    const z = setInterval(() => setSimdi(Date.now()), 5000);
    return () => clearInterval(z);
  }, []);

  // Oturum görünürken tazelenir; televizyon gün boyu açık kalabilsin.
  useEffect(() => {
    const z = setInterval(() => { if (!document.hidden) getSession().catch(() => {}); }, OTURUM_TAZELE_MS);
    return () => clearInterval(z);
  }, []);

  // ── TAM EKRAN + İMLEÇ ────────────────────────────────────────────────
  useEffect(() => {
    setTamEkranVar(Boolean(document.fullscreenEnabled));
    const degisti = () => setTamEkran(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', degisti);
    return () => document.removeEventListener('fullscreenchange', degisti);
  }, []);
  useEffect(() => {
    let z: ReturnType<typeof setTimeout> | null = null;
    const hareket = () => {
      setImlecGizli(false);
      if (z) clearTimeout(z);
      z = setTimeout(() => setImlecGizli(true), 3000);
    };
    hareket();
    window.addEventListener('mousemove', hareket);
    window.addEventListener('pointerdown', hareket);
    window.addEventListener('keydown', hareket);
    return () => {
      if (z) clearTimeout(z);
      window.removeEventListener('mousemove', hareket);
      window.removeEventListener('pointerdown', hareket);
      window.removeEventListener('keydown', hareket);
    };
  }, []);
  const tamEkranDegistir = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  const suan = simdi + fark;
  const kopuk = hata || bayatMi(sonBasari, simdi);
  const sonVeriSaati = veri ? saatYaz(Date.parse(veri.olusturuldu), dil) : null;
  const slaVar = veri?.sla != null;

  const ustDurum = useMemo(() => {
    if (oturumYok) return { renk: RENK.kritik, metin: p.oturumBitti };
    if (!veri) return { renk: RENK.soluk, metin: p.yukleniyor };
    if (kopuk) return { renk: RENK.uyari, metin: doldur(p.baglantiYok, { saat: sonVeriSaati ?? '' }) };
    return { renk: RENK.canli, metin: `${p.canli} · ${doldur(p.sonGuncelleme, { saat: sonVeriSaati ?? '' })}` };
  }, [oturumYok, veri, kopuk, sonVeriSaati, p]);

  return (
    <div className="cp-kok" lang={dil} style={{ cursor: imlecGizli ? 'none' : 'auto' }}>
      <style>{CSS}</style>

      {/* ── ÜST ŞERİT ─────────────────────────────────────────────────── */}
      <header className="cp-ust">
        <div className="cp-ust-sol">
          <Monogram size={38} />
          <div style={{ minWidth: 0 }}>
            <h1 className="cp-baslik">{p.baslik}</h1>
            {veri && <div className="cp-bayi">{veri.bayi}</div>}
          </div>
        </div>
        <div className="cp-ust-sag">
          <span className="cp-durum" role="status" aria-live="polite">
            <span className="cp-nokta" style={{ background: ustDurum.renk }} aria-hidden="true" />
            {ustDurum.metin}
          </span>
          <Saat dil={dil} fark={fark} />
          {tamEkranVar && (
            <button type="button" className="cp-dugme" onClick={tamEkranDegistir}>
              {tamEkran ? p.tamEkrandanCik : p.tamEkran}
            </button>
          )}
          {!tamEkran && <Link href="/dashboard" className="cp-dugme">{p.panele}</Link>}
        </div>
      </header>

      {oturumYok && (
        <div className="cp-serit-uyari" style={{ background: RENK.kritikZemin, border: `1px solid ${RENK.kritik}` }}>
          {p.oturumBitti}{' '}
          <a href="/login?next=/pano" style={{ color: RENK.metin, fontWeight: 800 }}>{p.girisYap}</a>
        </div>
      )}

      {!veri ? (
        <div className="cp-kutu" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: RENK.ikincil }}>
          {oturumYok ? p.oturumBitti : hata ? doldur(p.baglantiYok, { saat: '—' }) : p.yukleniyor}
        </div>
      ) : (
        <>
          {/* ── RAKAMLAR ──────────────────────────────────────────────── */}
          <section className="cp-kpi" style={{ ['--kpi-n' as string]: slaVar ? 4 : 2 }}>
            <div className="cp-kutu cp-acik">
              <p className="cp-etiket">{p.acikFis}</p>
              <p className="cp-buyuk">{veri.fis.toplam}</p>
              <div className="cp-serit" aria-hidden="true">
                {ACIK_DURUMLAR.map((d) => veri.fis.durum[d] > 0 && (
                  <span key={d} style={{ flex: veri.fis.durum[d], background: DURUM_RENGI[d] }} />
                ))}
              </div>
              <div className="cp-kirilim">
                {ACIK_DURUMLAR.map((d) => (
                  <div key={d} className="cp-kirilim-kalem">
                    <span className="cp-nokta" style={{ background: DURUM_RENGI[d] }} aria-hidden="true" />
                    <span className="cp-kirilim-ad">{p.durum[d]}</span>
                    <span className="cp-kirilim-n">{veri.fis.durum[d]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="cp-kutu">
              <p className="cp-etiket">{p.bugunAcilan}</p>
              <p className="cp-orta">{veri.fis.bugunAcilan}</p>
            </div>
            <div className="cp-kutu">
              <p className="cp-etiket">{p.bugunKapanan}</p>
              <p className="cp-orta">{veri.fis.bugunKapanan}</p>
              <p className="cp-alt">{p.kapananAlt}</p>
            </div>
            {veri.sla && <SlaKutulari t={t} sla={veri.sla} />}
          </section>

          {/* ── GÖVDE ─────────────────────────────────────────────────── */}
          <section className="cp-govde">
            <Teknisyenler t={t} satirlar={veri.teknisyenler} atanmamis={veri.fis.atanmamis} />

            <div className="cp-sag">
              <CihazSagligi t={t} c={veri.cihaz} />
              {(veri.talepler.portal || veri.talepler.whatsapp) && (
                <div className="cp-kutu">
                  <div className="cp-bolum-baslik"><h2>{p.talepler}</h2></div>
                  <div className="cp-cihaz">
                    {veri.talepler.portal && (
                      <Rakam etiket={p.portal} n={veri.talepler.portal.adet} vurgu={veri.talepler.portal.adet > 0 ? 'uyari' : null}
                        alt={veri.talepler.portal.enEski ? doldur(p.enEski, { sure: goreliYaz(t, veri.talepler.portal.enEski, suan) }) : null} />
                    )}
                    {veri.talepler.whatsapp && (
                      <Rakam etiket={p.whatsapp} n={veri.talepler.whatsapp.adet} vurgu={veri.talepler.whatsapp.adet > 0 ? 'uyari' : null}
                        alt={veri.talepler.whatsapp.enEski ? doldur(p.enEski, { sure: goreliYaz(t, veri.talepler.whatsapp.enEski, suan) }) : null} />
                    )}
                  </div>
                </div>
              )}
              <Olaylar t={t} olaylar={veri.olaylar} suan={suan} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function SlaKutulari({ t, sla }: { t: Sozluk; sla: NonNullable<CanliPanoVerisi['sla']> }) {
  const p = t.canliPano;
  if (sla.olculemiyor) {
    return (
      <div className="cp-kutu" style={{ gridColumn: 'span 2' }}>
        <p className="cp-etiket">{p.slaGecen}</p>
        <p className="cp-alt">{p.slaOlculemiyor}</p>
      </div>
    );
  }
  const enAcil = sla.liste[0];
  const satir = (s: typeof enAcil) => `${s.ticketNumber} · ${s.musteri} · ${s.tur === 'MUDAHALE' ? p.slaMudahale : p.slaCozum} `
    + (s.kalanDk < 0 ? doldur(p.slaGecti, { sure: sureYaz(t, -s.kalanDk) }) : doldur(p.slaKaldi, { sure: sureYaz(t, s.kalanDk) }));
  const gecen = sla.liste.filter((s) => s.kalanDk < 0);
  const yaklasan = sla.liste.filter((s) => s.kalanDk >= 0);
  return (
    <>
      <div className="cp-kutu" style={sla.gecen > 0 ? { background: RENK.kritikZemin, borderColor: RENK.kritik } : undefined}>
        <p className="cp-etiket">{sla.gecen > 0 ? '⚠ ' : ''}{p.slaGecen}</p>
        <p className="cp-orta">{sla.gecen}</p>
        <p className="cp-alt" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {gecen[0] ? satir(gecen[0]) : p.slaYok}
        </p>
      </div>
      <div className="cp-kutu" style={sla.yaklasan > 0 ? { background: RENK.uyariZemin, borderColor: RENK.uyari } : undefined}>
        <p className="cp-etiket">{sla.yaklasan > 0 ? '⏱ ' : ''}{p.slaYaklasan}</p>
        <p className="cp-orta">{sla.yaklasan}</p>
        <p className="cp-alt" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {yaklasan[0] ? satir(yaklasan[0]) : p.slaYok}
        </p>
      </div>
    </>
  );
}

function Teknisyenler({ t, satirlar, atanmamis }: { t: Sozluk; satirlar: TeknisyenSatiri[]; atanmamis: number }) {
  const p = t.canliPano;
  return (
    <div className="cp-kutu" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div className="cp-bolum-baslik">
        <h2>{p.teknisyenler}</h2>
        {atanmamis > 0 && (
          <span className="cp-alt" style={{ margin: 0, color: RENK.uyari, fontWeight: 700 }}>
            {doldur(p.atanmamis, { n: atanmamis })}
          </span>
        )}
      </div>
      {satirlar.length === 0 ? (
        <p className="cp-alt">{p.teknisyenYok}</p>
      ) : (
        <div className="cp-tek-liste">
          {satirlar.map((s, i) => {
            const renk = s.suanki ? (s.suanki.sahada ? RENK.canli : DURUM_RENGI[s.suanki.durum]) : RENK.soluk;
            const is = s.suanki
              ? [s.suanki.musteri, s.suanki.cihaz].filter(Boolean).join(' · ') || s.suanki.ticketNumber
              : s.sirada > 0 ? doldur(p.sirada, { n: s.sirada }) : p.isYok;
            const sure = s.suanki
              ? (s.suanki.sahada
                ? doldur(p.sahada, { sure: sureYaz(t, s.suanki.dakika) })
                : doldur(p.durumda, { durum: p.durum[s.suanki.durum], sure: sureYaz(t, s.suanki.dakika) }))
              : null;
            const notlar = [
              s.suanki && s.sirada > 0 ? doldur(p.sirada, { n: s.sirada }) : null,
              s.bugunKapatti > 0 ? doldur(p.bugunKapatti, { n: s.bugunKapatti }) : null,
            ].filter(Boolean).join(' · ');
            return (
              <div key={s.id} className={`cp-tek${i >= TV_TEKNISYEN ? ' cp-tek-fazla' : ''}`}>
                <span className="cp-nokta" style={{ background: renk, marginTop: 7 }} aria-hidden="true" />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p className="cp-tek-ad">{s.ad}</p>
                  <p className="cp-tek-is">{is}</p>
                </div>
                <div className="cp-tek-sag">
                  {sure && <div className="cp-tek-sure">{sure}</div>}
                  {notlar && <div className="cp-tek-not">{notlar}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {satirlar.length > TV_TEKNISYEN && (
        <p className="cp-alt cp-fazla-not">{doldur(p.dahaFazla, { n: satirlar.length - TV_TEKNISYEN })}</p>
      )}
    </div>
  );
}

function Rakam({ etiket, n, alt, vurgu }: { etiket: string; n: number | null; alt?: string | null; vurgu?: 'kritik' | 'uyari' | null }) {
  const renk = vurgu === 'kritik' ? RENK.kritik : vurgu === 'uyari' ? RENK.uyari : null;
  return (
    <div style={{ minWidth: 0, borderLeft: `3px solid ${renk ?? RENK.cizgi}`, paddingLeft: 10 }}>
      <p className="cp-etiket">{etiket}</p>
      <p className="cp-orta" style={{ fontSize: 'clamp(1.8rem, 2.4vw, 3.4rem)' }}>{n === null ? '—' : n}</p>
      {alt && <p className="cp-alt">{alt}</p>}
    </div>
  );
}

function CihazSagligi({ t, c }: { t: Sozluk; c: CanliPanoVerisi['cihaz'] }) {
  const p = t.canliPano;
  const izleniyor = c.izlenen > 0;
  return (
    <div className="cp-kutu">
      <div className="cp-bolum-baslik"><h2>{p.cihazSagligi}</h2></div>
      <div className="cp-cihaz">
        <Rakam etiket={p.uyariVeren} n={izleniyor ? c.uyari : null} vurgu={c.servisUyari > 0 ? 'kritik' : c.uyari > 0 ? 'uyari' : null}
          alt={izleniyor && c.servisUyari > 0 ? doldur(p.servisIsteyen, { n: c.servisUyari }) : null} />
        <Rakam etiket={p.tonerKritik} n={izleniyor ? c.tonerKritik : null} vurgu={c.tonerKritik > 0 ? 'uyari' : null}
          alt={izleniyor ? doldur(p.tonerAlt, { n: TONER_KRITIK }) : null} />
        <Rakam etiket={p.yoldaToner} n={c.yoldaToner} alt={p.yoldaAlt} />
        <Rakam etiket={p.sayacGelmeyen} n={c.sayacGelmeyen} vurgu={c.sayacGelmeyen > 0 ? 'uyari' : null}
          alt={doldur(p.sayacAlt, { n: SAYAC_GEC_GUN })} />
      </div>
      {!izleniyor && <p className="cp-alt" style={{ marginTop: 10 }}>{p.izlenmiyor}</p>}
    </div>
  );
}

function olayMetni(t: Sozluk, o: PanoOlayi): { tur: string; ayrinti: string } {
  const p = t.canliPano;
  const kim = [o.musteri, o.cihaz].filter(Boolean).join(' · ');
  const fis = o.ticketNumber ? `${o.ticketNumber} · ` : '';
  if (o.tur === 'YENI_FIS') return { tur: p.olay.YENI_FIS, ayrinti: fis + kim };
  if (o.tur === 'DURUM') {
    const ad = (t.durum.fis as Record<string, string>)[o.kod ?? ''] ?? (o.kod ?? '');
    return { tur: doldur(p.olay.DURUM, { durum: ad }), ayrinti: fis + kim };
  }
  if (o.tur === 'PORTAL') return { tur: o.kod === 'SAYAC' ? p.olay.PORTAL_SAYAC : p.olay.PORTAL_ARIZA, ayrinti: kim };
  const uyari = (t.tarayici.uyari as Record<string, string>)[o.kod ?? ''] ?? p.olay.UYARI;
  return { tur: uyari, ayrinti: kim };
}

function Olaylar({ t, olaylar, suan }: { t: Sozluk; olaylar: PanoOlayi[]; suan: number }) {
  const p = t.canliPano;
  const isaret: Record<PanoOlayi['tur'], string> = { YENI_FIS: '#3987E5', DURUM: '#7D8BA6', PORTAL: '#C98500', UYARI: '#E05555' };
  return (
    <div className="cp-kutu" style={{ minHeight: 0 }}>
      <div className="cp-bolum-baslik"><h2>{p.olaylar}</h2></div>
      {olaylar.length === 0 ? <p className="cp-alt">{p.olayYok}</p> : (
        <div>
          {olaylar.map((o) => {
            const m = olayMetni(t, o);
            return (
              <div key={`${o.tur}-${o.id}`} className="cp-olay">
                <span className="cp-olay-zaman">{goreliYaz(t, o.zaman, suan)}</span>
                <span className="cp-nokta" style={{ background: isaret[o.tur], alignSelf: 'center' }} aria-hidden="true" />
                <span className="cp-olay-metin">
                  <span className="cp-olay-tur">{m.tur}</span>
                  {m.ayrinti ? <span style={{ color: RENK.ikincil }}>{' · '}{m.ayrinti}</span> : null}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
