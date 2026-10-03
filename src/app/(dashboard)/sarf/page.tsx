'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import ContactActions from '@/components/ContactActions';
import { useT, useBicim, useMusteriDili } from '@/lib/i18n/client';
import { doldur, type Sozluk } from '@/lib/i18n/sozluk';
import type { Bicimleyici } from '@/lib/bicim';

interface Forecast {
  channel: string; yield: number; remaining: number | null; remainingPct: number | null;
  daysLeft: number | null; dailyRate: number | null; needsSetup: boolean;
  /** Yüzde cihazın kendisinden okundu (ağ tarayıcısı). */
  olculdu?: boolean;
}
interface Item {
  id: string; brand: string; model: string; serialNo: string; location: string | null;
  customer: { id: string; name: string; phone: string; address: string | null } | null;
  tonerChangedAt: string | null;
  black: Forecast | null; color: Forecast | null;
  soonestDaysLeft: number | null; needsSetup: boolean;
  olcumAt?: string | null;
  enAzYuzde?: number | null;
  // Verimin nereden geldiği — ölçülmüş bir sayıyla elle girilmiş bir
  // sayı aynı güvende değil ve bayi hangisine baktığını bilmeli.
  verimSb?: { deger: number | null; kaynak: string | null; gozlem: number; aciklama: string };
  verimRenkli?: { deger: number | null; kaynak: string | null; gozlem: number; aciklama: string };
  /** Nextus Mağaza sipariş bağlantısı — mağaza kurulu ve müşteri paneli açıksa dolu. */
  magazaLink?: string | null;
  /** Toner sevki: kanal başına ihtiyaç, önerilen toner ve yolda olan sevk. */
  kanallar?: Partial<Record<Kanal, KanalSevk>> | null;
}

type Kanal = 'BLACK' | 'COLOR';
interface KanalSevk {
  ihtiyac: 'OLCUM' | 'TAHMIN' | null;
  oneri: { id: string; ad: string; stok: number; kaynak: 'SON_TAKILAN' | 'FIS' | 'MODEL' } | null;
  yolda: { id: string; tarih: string; parcaAd: string | null } | null;
}
interface TonerParcasi { id: string; ad: string; kod: string | null; stok: number }
type SevkCevabi = { ok: boolean; hata?: string }

const PARCASIZ = '__yok';

/**
 * Bir kanal için toner sevki. Yolda olan varsa onu ve geri alma düğmesini,
 * ihtiyaç varsa "Toner gönder"i gösterir. Önerilen toner seçili gelir:
 * cihaza geçen sefer takılan → fişte kullanılan → modelde en sık takılan.
 * Stokta olmayan toner gönderilemez; tedarikçi siparişine yönlendirilir.
 */
function SevkKontrol({ deviceId, kanal, k, parcalar, t, b, mesgul, onGonder, onIptal }: {
  deviceId: string; kanal: Kanal; k: KanalSevk; parcalar: TonerParcasi[]; t: Sozluk; b: Bicimleyici; mesgul: boolean;
  onGonder: (deviceId: string, kanal: Kanal, partId: string | null) => void;
  onIptal: (id: string) => void;
}) {
  const [acik, setAcik] = useState(false);
  const [secim, setSecim] = useState<string>(k.oneri?.id ?? '');
  const sz = t.sarf as unknown as Record<string, string>;
  if (k.yolda) {
    return (
      <div style={{ fontSize: '0.78rem', color: '#0369a1', marginTop: 3, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600 }}>{t.sarf.yolda} · {b.tarih(k.yolda.tarih)}{k.yolda.parcaAd ? ` · ${k.yolda.parcaAd}` : ''}</span>
        <button type="button" disabled={mesgul} onClick={() => onIptal(k.yolda!.id)}
          style={{ background: 'none', border: 'none', padding: 0, color: '#64748b', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.75rem' }}>
          {t.sarf.iptal}
        </button>
      </div>
    );
  }
  if (!k.ihtiyac) return null;
  if (!acik) {
    return (
      <button type="button" onClick={() => setAcik(true)}
        style={{ marginTop: 4, padding: '0.25rem 0.65rem', borderRadius: 8, border: '1px solid #bae6fd', background: '#f0f9ff', color: '#0369a1', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
        {t.sarf.tonerGonder}
      </button>
    );
  }
  const secili = parcalar.find((p) => p.id === secim);
  const stokYok = Boolean(secili) && secili!.stok < 1;
  return (
    <div style={{ marginTop: 6, padding: '0.55rem 0.65rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, display: 'grid', gap: 6, maxWidth: 520 }}>
      <select value={secim} onChange={(e) => setSecim(e.target.value)} aria-label={t.sarf.tonerGonder}
        style={{ padding: '0.35rem 0.5rem', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', background: 'white' }}>
        {!k.oneri && <option value="" disabled>{t.sarf.parcaSec}</option>}
        {parcalar.map((p) => (
          <option key={p.id} value={p.id}>{p.ad}{p.kod ? ` (${p.kod})` : ''} — {doldur(t.sarf.stokAdet, { n: p.stok })}</option>
        ))}
        <option value={PARCASIZ}>{t.sarf.parcasiz}</option>
      </select>
      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
        {k.oneri && secim === k.oneri.id ? sz[`oneri${k.oneri.kaynak}`] : !k.oneri ? t.sarf.oneriYok : null}
      </div>
      {stokYok && (
        <div style={{ fontSize: '0.75rem', color: '#b91c1c' }}>
          {t.sarf.stokYok} <Link href="/siparis" style={{ color: '#1d4ed8' }}>{t.sarf.siparisLink}</Link>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" disabled={mesgul || stokYok || !secim} onClick={() => onGonder(deviceId, kanal, secim === PARCASIZ ? null : secim)}
          style={{ padding: '0.35rem 0.9rem', borderRadius: 8, border: 'none', background: mesgul || stokYok || !secim ? '#94a3b8' : '#0369a1', color: 'white', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
          {t.sarf.gonder}
        </button>
        <button type="button" onClick={() => setAcik(false)}
          style={{ padding: '0.35rem 0.7rem', borderRadius: 8, border: '1px solid #cbd5e1', background: 'white', fontSize: '0.8rem', cursor: 'pointer' }}>
          {t.sarf.vazgec}
        </button>
      </div>
    </div>
  );
}

/** Cihazın ölçtüğü yüzdeden aciliyet: gün tahmini olmasa da %8 kırmızıdır. */
function yuzdeGunu(pct: number | null | undefined): number | null {
  if (pct == null) return null;
  return pct <= 10 ? 0 : pct <= 20 ? 10 : 30;
}

// Aciliyet metnin renginde (kanal satırı) ve çerçevenin hafif tonunda.
function sev(days: number | null): { border: string; text: string } {
  if (days == null) return { border: '#e5e7eb', text: '#6b7280' };
  if (days <= 7) return { border: '#fecaca', text: '#b91c1c' };
  if (days <= 14) return { border: '#fde68a', text: '#92400e' };
  return { border: '#bbf7d0', text: '#15803d' };
}

function ChannelLine({ f, name, t, b }: { f: Forecast | null; name: string; t: Sozluk; b: Bicimleyici }) {
  if (!f) return null;
  let txt: string;
  if (f.needsSetup) txt = t.sarf.bekliyor;
  else if (f.olculdu && f.daysLeft == null) txt = doldur(t.sarf.olculenYuzde, { yuzde: f.remainingPct ?? 0 });
  else if (f.daysLeft == null) txt = doldur(t.sarf.gunTahminiYok, { yuzde: f.remainingPct ?? 0 });
  else txt = doldur(f.olculdu ? t.sarf.gunSonraOlcum : t.sarf.gunSonra, { gun: f.daysLeft, yuzde: f.remainingPct ?? 0, kalan: b.sayi(f.remaining ?? 0) });
  const s = sev(f.needsSetup ? null : f.daysLeft ?? (f.olculdu ? yuzdeGunu(f.remainingPct) : null));
  return (
    <div style={{ fontSize: '0.83rem', color: s.text, fontWeight: 600, marginTop: 3 }}>
      {name}: {txt}
      {f.olculdu && <span title={t.sarf.olculduIpucu} style={{ marginLeft: 6, fontSize: '0.7rem', fontWeight: 700, color: '#0369a1', background: '#e0f2fe', borderRadius: 999, padding: '0.05rem 0.45rem' }}>{t.sarf.olculdu}</span>}
    </div>
  );
}

/**
 * Müşteriye gidecek WhatsApp metni.
 *
 * Tahmin YOKSA gün sayısı yazılmaz. "Yakında bitiyor" demek için elde bir
 * hesap olmalı; olmadığında yalnız hatırlatma yapılır. Uydurulmuş bir gün
 * sayısı, gereksiz toner satmaktır.
 */
function siparisMesaji(i: Item, mt: Sozluk): string {
  const cihaz = i.brand + ' ' + i.model + (i.location ? ' (' + i.location + ')' : '');
  // Toner zaten yola çıktıysa müşteriye "bitiyor" değil "geliyor" denir.
  if (i.kanallar?.BLACK?.yolda || i.kanallar?.COLOR?.yolda) return doldur(mt.sarf.mesajYolda, { cihaz });
  const gun =
    i.soonestDaysLeft != null && !i.needsSetup
      ? doldur(mt.sarf.mesajGun, { cihaz, gun: i.soonestDaysLeft })
      : i.enAzYuzde != null
        ? doldur(mt.sarf.mesajYuzde, { cihaz, yuzde: i.enAzYuzde })
        : doldur(mt.sarf.mesajYakinda, { cihaz });
  const link = i.magazaLink ? doldur(mt.sarf.mesajLink, { link: i.magazaLink }) : '';
  return gun + link;
}

/**
 * Verimin NEREDEN geldiği. Gizlenmiyor: "2.000 sayfa" yazan bir satırın
 * elle girilmiş bir tahmin mi yoksa altı kartuşta ölçülmüş bir gözlem mi
 * olduğu, bayinin o tahmine ne kadar güveneceğini belirliyor.
 */
/** Sunucudan gelen `kaynak` + `gozlem` alanlarından kullanıcının dilinde tek cümle. */
function kaynakMetni(v: NonNullable<Item['verimSb']>, t: Sozluk): string {
  const n = v.gozlem;
  if (v.kaynak === 'CIHAZ') return doldur(n === 1 ? t.sarf.verimCihazTek : t.sarf.verimCihaz, { n });
  if (v.kaynak === 'MODEL') return doldur(t.sarf.verimModel, { n });
  if (v.kaynak === 'POPULASYON') return doldur(t.sarf.verimPopulasyon, { n });
  return v.aciklama;
}

function VerimKaynagi({ v, ad, t, b }: { v?: Item['verimSb']; ad: string; t: Sozluk; b: Bicimleyici }) {
  if (!v || !v.deger || v.kaynak === 'ELLE') return null;
  return (
    <div style={{ fontSize: '0.74rem', color: '#047857', marginTop: 2 }}>
      {doldur(t.sarf.verimKaynagi, { ad, n: b.sayi(v.deger), aciklama: kaynakMetni(v, t) })}
    </div>
  );
}

export default function SarfPage() {
  const t = useT();
  const b = useBicim();
  // Sipariş mesajını müşteri okuyor: bayinin dili geçerli.
  const musteri = useMusteriDili();
  const [items, setItems] = useState<Item[]>([]);
  const [tracked, setTracked] = useState(0);
  const [urgent, setUrgent] = useState(0);
  const [olculen, setOlculen] = useState(0);
  const [bilinmeyen, setBilinmeyen] = useState(0);
  const [canli, setCanli] = useState(0);
  const [loading, setLoading] = useState(true);
  const [parcalar, setParcalar] = useState<TonerParcasi[]>([]);
  const [hazir, setHazir] = useState(0);
  const [mesgul, setMesgul] = useState(false);
  const [bilgi, setBilgi] = useState<{ metin: string; hata: boolean } | null>(null);

  const yukle = useCallback(() => {
    return fetch('/api/toner').then((r) => r.json()).then((d) => {
      setItems(Array.isArray(d.items) ? d.items : []);
      setTracked(d.trackedCount || 0);
      setUrgent(d.urgent || 0);
      setOlculen(d.olculen || 0);
      setBilinmeyen(d.bilinmeyen || 0);
      setCanli(d.canli || 0);
      setParcalar(Array.isArray(d.tonerParcalari) ? d.tonerParcalari : []);
      setHazir(d.hazir || 0);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);
  useEffect(() => { yukle(); }, [yukle]);

  // ── TONER SEVKİ ─────────────────────────────────────────────────
  const sevkGonder = async (sevkler: { deviceId: string; channel: Kanal; partId: string | null }[]) => {
    setMesgul(true); setBilgi(null);
    try {
      const r = await fetch('/api/toner-sevk', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sevkler }) });
      const j = await r.json().catch(() => ({}));
      const sonuc: SevkCevabi[] = Array.isArray(j.sonuc) ? j.sonuc : [];
      const red = sonuc.filter((s) => !s.ok);
      const sebepler = [...new Set(red.map((s) => (t.sarf.sevkHata as Record<string, string>)[s.hata ?? ''] ?? s.hata ?? ''))].join(', ');
      const parca = [
        j.gonderilen ? doldur(t.sarf.gonderildi, { n: j.gonderilen }) : '',
        red.length ? doldur(t.sarf.gonderilemedi, { n: red.length, sebep: sebepler }) : '',
      ].filter(Boolean).join(' ');
      setBilgi({ metin: parca || t.sarf.sevkHata.CIHAZ_YOK, hata: !j.gonderilen });
      await yukle();
    } finally {
      setMesgul(false);
    }
  };
  const sevkIptal = async (id: string) => {
    if (!window.confirm(t.sarf.iptalSor)) return;
    setMesgul(true); setBilgi(null);
    try {
      const r = await fetch(`/api/toner-sevk/${id}`, { method: 'DELETE' });
      setBilgi(r.ok ? { metin: t.sarf.iptalEdildi, hata: false } : { metin: t.sarf.sevkHata.CIHAZ_YOK, hata: true });
      await yukle();
    } finally {
      setMesgul(false);
    }
  };
  // "Hepsini gönder": ihtiyacı olan, yolda olmayan ve önerilen toneri stokta olan her kanal.
  const hazirSevkler = items.flatMap((i) => (['BLACK', 'COLOR'] as Kanal[])
    .filter((k) => { const s = i.kanallar?.[k]; return s?.ihtiyac && !s.yolda && s.oneri && s.oneri.stok >= 1; })
    .map((k) => ({ deviceId: i.id, channel: k, partId: i.kanallar![k]!.oneri!.id })));
  const hepsiniGonder = () => {
    if (!hazirSevkler.length || !window.confirm(doldur(t.sarf.hepsiniSor, { n: hazirSevkler.length }))) return;
    sevkGonder(hazirSevkler);
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: 880, margin: '0 auto' }}>
      <div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>{t.sarf.baslik}</h1>
        <p style={{ color: '#6b7280', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
          {t.sarf.alt}
        </p>
      </div>

      {/* ── VERİM ARTIK SORULMUYOR, ÖLÇÜLÜYOR ──────────────────────────
          İki toner değişimi arasında basılan sayfa, o cihazın gerçek
          verimi. Bayi hiçbir şey yazmadan, toner değiştirdikçe doluyor. */}
      {olculen > 0 && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', borderRadius: 10, padding: '0.6rem 0.9rem', marginTop: '0.9rem', fontSize: '0.84rem' }}>
          <b>{doldur(t.sarf.olculenVurgu, { n: olculen })}</b> {t.sarf.olculenSon}
        </div>
      )}
      {canli > 0 && (
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1', borderRadius: 10, padding: '0.6rem 0.9rem', marginTop: '0.6rem', fontSize: '0.84rem' }}>
          <b>{doldur(t.sarf.canliVurgu, { n: canli })}</b> {t.sarf.canliSon}
        </div>
      )}
      {/* ── TEK ONAYLA SEVK ── Toneri bitmek üzere olan ve uyan toneri stokta
          olan bütün cihazlar tek düğmeyle "yolda" olur; stok düşer. */}
      {hazir > 0 && hazirSevkler.length > 0 && (
        <div style={{ background: '#fefce8', border: '1px solid #fde68a', color: '#713f12', borderRadius: 10, padding: '0.6rem 0.9rem', marginTop: '0.6rem', fontSize: '0.84rem', display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span><b>{doldur(t.sarf.hazirVurgu, { n: hazirSevkler.length })}</b> {t.sarf.hazirSon}</span>
          <button type="button" disabled={mesgul} onClick={hepsiniGonder}
            style={{ padding: '0.4rem 0.9rem', borderRadius: 8, border: 'none', background: mesgul ? '#94a3b8' : '#a16207', color: 'white', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {doldur(t.sarf.hepsiniGonder, { n: hazirSevkler.length })}
          </button>
        </div>
      )}
      {bilgi && (
        <div role="status" style={{ background: bilgi.hata ? '#fef2f2' : '#f0fdf4', border: `1px solid ${bilgi.hata ? '#fecaca' : '#bbf7d0'}`, color: bilgi.hata ? '#991b1b' : '#166534', borderRadius: 10, padding: '0.55rem 0.9rem', marginTop: '0.6rem', fontSize: '0.84rem' }}>
          {bilgi.metin}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, margin: '1rem 0' }}>
        <div style={{ flex: 1, background: 'white', border: '1px solid #fecaca', borderRadius: 10, padding: '0.7rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#b91c1c', fontWeight: 700 }}>{t.sarf.yakinda}</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#b91c1c' }}>{urgent}</div>
        </div>
        <div style={{ flex: 1, background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '0.7rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 700 }}>{t.sarf.takipteki}</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{tracked}</div>
        </div>
        <div style={{ flex: 1, background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '0.7rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 700 }}>{t.sarf.verimsiz}</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: bilinmeyen ? '#b45309' : '#9ca3af' }}>{bilinmeyen}</div>
          <div style={{ fontSize: '0.68rem', color: '#9ca3af' }}>{t.sarf.verimsizAlt}</div>
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#9ca3af' }}>{t.genel.yukleniyor}</p>
      ) : items.length === 0 ? (
        <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 12, padding: '2rem', textAlign: 'center' }}>
          {/* ── LİSTE NEDEN BOŞ, TEK CÜMLEYLE ────────────────────────────
              Buraya "bir cihaz detayına girip verimi yazın" yazıyordu.
              Talimat doğruydu ama 854 cihazlı bir bayide kimsenin
              yapmayacağı bir iş tarif ediyordu — ve ölçüldü: 853 cihazda
              verim boş, yani bu ekran kurulduğundan beri boş.

              Verim CİHAZIN değil MODELİN özelliği. Toplu ekranda 396 satır
              var ve ilk 20'si 250 cihazı açıyor. Yönlendirme oraya. */}
          <p style={{ color: '#374151', fontWeight: 600, margin: '0 0 0.5rem' }}>{t.sarf.bosBaslik}</p>
          <p style={{ color: '#6b7280', fontSize: '0.88rem', margin: '0 0 1rem' }}>
            {t.sarf.bosAltOn} <b>{t.sarf.bosAltVurgu}</b> {t.sarf.bosAltSon}
          </p>
          <Link
            href="/toner-verimi"
            style={{ display: 'inline-block', background: '#2563eb', color: '#fff', padding: '0.55rem 1rem', borderRadius: 8, fontSize: '0.88rem', fontWeight: 600, textDecoration: 'none' }}
          >
            {t.sarf.verimleriGir}
          </Link>
          <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0.75rem 0 0' }}>
            {t.sarf.tekCihazOn} <b>{t.sarf.tekCihazVurgu}</b> {t.sarf.tekCihazSon}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {items.map((i) => {
            const s = sev(i.needsSetup ? null : i.soonestDaysLeft ?? yuzdeGunu(i.enAzYuzde));
            return (
              <div key={i.id} style={{ background: 'white', border: `1px solid ${s.border}`, borderRadius: 12, padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{i.brand} {i.model} <span style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 400 }}>· SN {i.serialNo}</span></div>
                    <div style={{ fontSize: '0.85rem', color: '#374151', marginTop: 2 }}>
                      👤 {i.customer ? <Link href={`/customers/${i.customer.id}`} style={{ color: '#1d4ed8', textDecoration: 'none' }}>{i.customer.name}</Link> : '—'}
                      {i.location ? ` · ${i.location}` : ''}
                    </div>
                    <ChannelLine f={i.black} name={t.sarf.siyah} t={t} b={b} />
                    {i.kanallar?.BLACK && <SevkKontrol deviceId={i.id} kanal="BLACK" k={i.kanallar.BLACK} parcalar={parcalar} t={t} b={b} mesgul={mesgul} onGonder={(d, k, p) => sevkGonder([{ deviceId: d, channel: k, partId: p }])} onIptal={sevkIptal} />}
                    <ChannelLine f={i.color} name={t.sarf.renkli} t={t} b={b} />
                    {i.kanallar?.COLOR && <SevkKontrol deviceId={i.id} kanal="COLOR" k={i.kanallar.COLOR} parcalar={parcalar} t={t} b={b} mesgul={mesgul} onGonder={(d, k, p) => sevkGonder([{ deviceId: d, channel: k, partId: p }])} onIptal={sevkIptal} />}
                    <VerimKaynagi v={i.verimSb} ad={t.sarf.verimSbAd} t={t} b={b} />
                    <VerimKaynagi v={i.verimRenkli} ad={t.sarf.verimRenkliAd} t={t} b={b} />
                  </div>
                  <Link href={`/devices/${i.id}`} style={{ flexShrink: 0, padding: '0.5rem 0.9rem', background: '#0ea5e9', color: 'white', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>{t.sarf.cihazaGit}</Link>
                </div>
                {i.customer && (
                  <ContactActions
                    phone={i.customer.phone}
                    address={i.customer.address}
                    /* Mağaza kuruluysa WhatsApp mesajına sipariş bağlantısı gömülür:
                       teknisyen "toner bitiyor" derken müşteri tek tıkla sipariş
                       verebilsin. Bağlantı yoksa mesaj sade kalır — kırık bir
                       bağlantı göndermek hiç göndermemekten kötüdür. */
                    whatsappText={siparisMesaji(i, musteri.sz)}
                  />
                )}
              </div>
            );
          })}
          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.25rem 0 0' }}>{t.sarf.sevkNot}</p>
        </div>
      )}
    </div>
  );
}
