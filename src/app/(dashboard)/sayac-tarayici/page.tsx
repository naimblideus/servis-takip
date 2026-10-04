'use client';

/**
 * AĞ TARAYICI — müşterinin ağındaki yazıcıların sayacını cihazın kendisinden
 * okuyan tarayıcının paneli.
 *
 * Üç iş: tarayıcıyı indirmek (anahtar dosyanın içine gömülür), "onaysız
 * yaz" tercihini yönetmek, gelen taramaları cihaz cihaz karşılaştırıp
 * onaylamak. Karşılaştırma ekranın asıl işi: bayi SNMP sayacının kendi
 * fatura sayacıyla aynı şeyi saydığını burada GÖRMEDEN otomatiği açmamalı.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useT, useBicim, useDil } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';
import { UYARI_TURU, UYARI_KATEGORISI, TONER_KRITIK, PARCA_KRITIK, parcaKategorisi, type UyariKodu, type UyariTuru } from '@/lib/sayac-tarama';

type Durum = 'YAZILABILIR' | 'YAZILDI' | 'DEGISMEDI' | 'GERILEDI' | 'ESLESMEDI' | 'BIRDEN_FAZLA' | 'AYRIM_YOK' | 'SAYAC_YOK' | 'HATA';

interface Sonuc {
  ip: string; marka: string | null; model: string | null; seri: string | null;
  deviceId: string | null; toplam: number | null;
  siyah: number | null; renkli: number | null;
  ayrim: 'TEK_RENK' | 'DOGRULANDI' | 'YOK'; sebep: string | null;
  sonSiyah: number | null; sonRenkli: number | null;
  durum: Durum; hataKodu?: string | null;
  sarf: { ad: string; yuzde: number | null }[];
  // Eski taramalarda yok.
  uyarilar?: UyariKodu[];
  olcum?: { siyah: number | null; renkli: number | null };
  tonerDegisti?: boolean;
  fisAcildi?: string | null;
  eklendi?: boolean;
}
interface Tarama {
  id: string; createdAt: string; bilgisayar: string | null; taranan: number;
  bulunan: number; eslesen: number; yazilabilir: number; yazilan: number;
  sonuc: Sonuc[]; onaylandiAt: string | null;
}
interface DikkatCihazi {
  id: string; etiket: string; seri: string; kod: string; konum: string | null;
  musteri: { id: string; ad: string } | null;
  olcumAt: string; olcumSiyah: number | null; olcumRenkli: number | null;
  olcumParca: number | null; parcaAd: string | null;
  uyarilar: UyariKodu[]; uyariAt: string | null;
  acikFis: { id: string; ticketNumber: string } | null;
}
interface Bilgisayar {
  bilgisayar: string | null; sonTarama: string; sonBulunan: number; haftalik: number;
  surum: number | null; sessiz: boolean; eski: boolean;
}
interface Liste {
  taramalar: Tarama[];
  cihazlar: Record<string, { etiket: string; seri: string; musteri: string | null; musteriId?: string | null }>;
  durum?: { izlenen: number; cihazlar: DikkatCihazi[] };
  bilgisayarlar?: Bilgisayar[];
}

const TUR_RENGI: Record<UyariTuru, { bg: string; fg: string }> = {
  SERVIS: { bg: '#fee2e2', fg: '#991b1b' },
  SARF: { bg: '#fef3c7', fg: '#92400e' },
  BILGI: { bg: '#f3f4f6', fg: '#4b5563' },
};

const rozet = (r: { bg: string; fg: string }): React.CSSProperties => ({
  background: r.bg, color: r.fg, padding: '0.12rem 0.5rem', borderRadius: 999, fontWeight: 700, fontSize: '0.74rem', whiteSpace: 'nowrap',
});

const GUN_MS = 86_400_000;

const RENK: Record<Durum, { bg: string; fg: string }> = {
  YAZILABILIR: { bg: '#dbeafe', fg: '#1e40af' },
  YAZILDI: { bg: '#d1fae5', fg: '#065f46' },
  DEGISMEDI: { bg: '#f3f4f6', fg: '#4b5563' },
  GERILEDI: { bg: '#fef3c7', fg: '#92400e' },
  ESLESMEDI: { bg: '#fee2e2', fg: '#991b1b' },
  BIRDEN_FAZLA: { bg: '#fef3c7', fg: '#92400e' },
  AYRIM_YOK: { bg: '#f3f4f6', fg: '#4b5563' },
  SAYAC_YOK: { bg: '#f3f4f6', fg: '#4b5563' },
  HATA: { bg: '#fee2e2', fg: '#991b1b' },
};

const kart: React.CSSProperties = { background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1.1rem 1.25rem', marginBottom: '1rem' };

/** Yazıcının bildirdiği model çoğu zaman markayı da içeriyor ("HP LaserJet…"); marka iki kez yazılmasın. */
function cihazAdi(marka: string | null, model: string | null): string {
  if (!model) return marka || '—';
  if (!marka) return model;
  const m = model.toLowerCase(), k = marka.toLowerCase();
  return m === k || m.startsWith(`${k} `) ? model : `${marka} ${model}`;
}

export default function SayacTarayiciPage() {
  const t = useT();
  const tt = t.tarayici;
  const b = useBicim();
  const { dil } = useDil();
  const [ayar, setAyar] = useState<{ anahtarVar: boolean; otomatik: boolean; otomatikFis?: boolean } | null>(null);
  const [liste, setListe] = useState<Liste | null>(null);
  const [acik, setAcik] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  // Taramadan cihaz ekleme: müşteri listesi yalnız gerektiğinde çekilir;
  // işareti KALDIRILAN seriler ve seçilen müşteri tarama başına tutulur.
  const [musteriler, setMusteriler] = useState<{ id: string; name: string }[] | null>(null);
  const [cikarilan, setCikarilan] = useState<Record<string, string[]>>({});
  const [ekleMusteri, setEkleMusteri] = useState<Record<string, string>>({});

  const yukle = useCallback(async () => {
    const [a, l] = await Promise.all([
      fetch('/api/sayac/tarayici/ayar').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/sayac/tarayici').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    setAyar(a);
    setListe(l);
    if (l?.taramalar?.[0]) setAcik((x) => x ?? l.taramalar[0].id);
  }, []);
  useEffect(() => { yukle(); }, [yukle]);

  // Anahtar sunucuda saklanmıyor (yalnız özeti); tek fırsat bu an. Dosya
  // tarayıcıda (istemcide) hazırlanıyor: şablon + adres + anahtar + dil.
  const indir = async () => {
    if (ayar?.anahtarVar && !window.confirm(tt.yeniAnahtarUyari)) return;
    setMesgul(true); setHata(null); setBilgi(null);
    try {
      const r = await fetch('/api/sayac/tarayici/ayar', { method: 'POST' });
      const j = await r.json();
      if (!r.ok || !j.anahtar) throw new Error(j.error || tt.indirilemedi);
      const sablon = await fetch('/tarayici/nextus-sayac-tarayici.ps1', { cache: 'no-store' }).then((x) => x.text());
      const metin = sablon
        .replace("'__SUNUCU__'", `'${window.location.origin}'`)
        .replace("'__ANAHTAR__'", `'${j.anahtar}'`)
        .replace("'__DIL__'", `'${dil}'`);
      // BOM şart: Windows PowerShell 5.1 BOM'suz dosyayı ANSI okur ve
      // Türkçe harfler bozulur. fetch().text() BOM'u düşürüyor, geri eklenir.
      const url = URL.createObjectURL(new Blob(['﻿' + metin], { type: 'text/plain;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'nextus-sayac-tarayici.ps1';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setBilgi(tt.indirildi);
      await yukle();
    } catch (e) {
      setHata(e instanceof Error ? e.message : tt.indirilemedi);
    } finally {
      setMesgul(false);
    }
  };

  const otomatikDegistir = async (deger: boolean) => {
    if (deger && !window.confirm(tt.otomatikUyari)) return;
    setMesgul(true); setHata(null);
    const r = await fetch('/api/sayac/tarayici/ayar', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ otomatik: deger }) });
    if (!r.ok) setHata((await r.json().catch(() => ({})))?.error ?? tt.kaydedilemedi);
    await yukle();
    setMesgul(false);
  };

  const otomatikFisDegistir = async (deger: boolean) => {
    if (deger && !window.confirm(tt.otomatikFisUyari)) return;
    setMesgul(true); setHata(null);
    const r = await fetch('/api/sayac/tarayici/ayar', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ otomatikFis: deger }) });
    if (!r.ok) setHata((await r.json().catch(() => ({})))?.error ?? tt.kaydedilemedi);
    await yukle();
    setMesgul(false);
  };

  const onayla = async (id: string) => {
    setMesgul(true); setHata(null); setBilgi(null);
    const r = await fetch(`/api/sayac/tarayici/${id}`, { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setHata(j.error ?? tt.kaydedilemedi);
    else setBilgi(doldur(tt.kaydedildi, { n: j.ozet?.yazilan ?? 0 }));
    await yukle();
    setMesgul(false);
  };

  // ── Taramadan cihaz ekleme ── Yeni bayinin ilk günü: tarayıcının bulduğu
  // ama sistemde olmayan yazıcılar tek tıkla cihaz olur. Seri, marka, model
  // ve sayaç sunucuda taramadan okunur; buradan yalnız seçim gider.
  const eklenebilir = (tr: Tarama) => tr.sonuc.filter((s) => s.durum === 'ESLESMEDI' && !s.deviceId && s.seri);
  // Varsayılan müşteri: bu taramada zaten eşleşen cihazların en çok bağlı olduğu.
  const varsayilanMusteri = (tr: Tarama) => {
    const say = new Map<string, number>();
    for (const s of tr.sonuc) {
      const m = s.deviceId ? liste?.cihazlar[s.deviceId]?.musteriId : null;
      if (m) say.set(m, (say.get(m) ?? 0) + 1);
    }
    return [...say.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? '';
  };
  const acikTarama = liste?.taramalar.find((x) => x.id === acik) ?? null;
  const eklemeVar = Boolean(acikTarama && eklenebilir(acikTarama).length);
  useEffect(() => {
    if (!eklemeVar || musteriler) return;
    fetch('/api/customers')
      .then((r) => (r.ok ? r.json() : []))
      .then((l) => setMusteriler(Array.isArray(l) ? l.map((m: { id: string; name: string }) => ({ id: m.id, name: m.name })) : []))
      .catch(() => setMusteriler([]));
  }, [eklemeVar, musteriler]);

  const isaretDegistir = (taramaId: string, seri: string, secili: boolean) =>
    setCikarilan((x) => {
      const l = x[taramaId] ?? [];
      return { ...x, [taramaId]: secili ? l.filter((s) => s !== seri) : [...l, seri] };
    });

  const ekle = async (tr: Tarama) => {
    const customerId = ekleMusteri[tr.id] ?? varsayilanMusteri(tr);
    const cik = cikarilan[tr.id] ?? [];
    const seriler = eklenebilir(tr).map((s) => s.seri as string).filter((s) => !cik.includes(s));
    if (!customerId || !seriler.length) return;
    setMesgul(true); setHata(null); setBilgi(null);
    const r = await fetch(`/api/sayac/tarayici/${tr.id}/cihaz`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ customerId, seriler }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setHata(j.error ?? tt.kaydedilemedi);
    else setBilgi([
      j.eklenen ? doldur(tt.eklendiBilgi, { n: j.eklenen }) : null,
      j.zatenVar ? doldur(tt.zatenVarBilgi, { n: j.zatenVar }) : null,
    ].filter(Boolean).join(' '));
    await yukle();
    setMesgul(false);
  };

  const ekleKutusu = (tr: Tarama) => {
    const adaylar = eklenebilir(tr);
    if (!adaylar.length) return null;
    const cik = cikarilan[tr.id] ?? [];
    const secili = adaylar.filter((s) => !cik.includes(s.seri as string)).length;
    const customerId = ekleMusteri[tr.id] ?? varsayilanMusteri(tr);
    const kapali = mesgul || !customerId || secili === 0;
    return (
      <div style={{ margin: '0.9rem 0 0.4rem', padding: '0.85rem 1rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10 }}>
        <strong style={{ display: 'block', color: '#1e3a8a' }}>{doldur(tt.ekleBaslik, { n: adaylar.length })}</strong>
        <p style={{ margin: '0.25rem 0 0.65rem', fontSize: '0.84rem', color: '#374151' }}>{tt.ekleAciklama}</p>
        {musteriler && musteriler.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.86rem', color: '#374151' }}>
            {tt.ekleMusteriYok}{' '}
            <Link href="/customers/new" style={{ color: '#1d4ed8', fontWeight: 700, textDecoration: 'none' }}>{tt.ekleMusteriEkle}</Link>
          </p>
        ) : (
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={customerId} disabled={!musteriler || mesgul} aria-label={tt.ekleMusteriSec}
              onChange={(e) => setEkleMusteri((x) => ({ ...x, [tr.id]: e.target.value }))}
              style={{ padding: '0.45rem 0.6rem', border: '1px solid #d1d5db', borderRadius: 8, minWidth: 220, maxWidth: '100%', background: 'white' }}>
              <option value="">{musteriler ? tt.ekleMusteriSec : t.genel.yukleniyor}</option>
              {(musteriler ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <button onClick={() => ekle(tr)} disabled={kapali}
              style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: kapali ? 'default' : 'pointer', opacity: kapali ? 0.55 : 1 }}>
              {doldur(tt.ekleDugme, { n: secili })}
            </button>
          </div>
        )}
      </div>
    );
  };

  const fark = (yeni: number | null, eski: number | null) =>
    yeni === null ? '—' : eski === null ? tt.ilkOkuma : `${yeni - eski >= 0 ? '+' : ''}${b.sayi(yeni - eski)}`;

  const uyariAdi = (u: UyariKodu) => (tt.uyari as Record<string, string>)[u] ?? u;
  const tonerMetni = (siyah: number | null | undefined, renkli: number | null | undefined) =>
    [siyah != null ? `${tt.sb} ${b.yuzde(siyah)}` : null, renkli != null ? `${tt.renkli} ${b.yuzde(renkli)}` : null].filter(Boolean).join(' · ');
  const sure = (iso: string | null) => {
    if (!iso) return null;
    const n = Math.floor((Date.now() - new Date(iso).getTime()) / GUN_MS);
    return n < 1 ? tt.bugun : doldur(tt.gundur, { n });
  };
  // Uyarıdan fiş: cihaz, sorun metni ve (cihaz söylüyorsa) arıza kategorisi dolu gelir.
  const parcaMetni = (c: DikkatCihazi) => (c.olcumParca !== null ? `${c.parcaAd ?? ''} ${b.yuzde(c.olcumParca)}`.trim() : '');
  const fisLinki = (c: DikkatCihazi) => {
    const servis = c.uyarilar.filter((u) => UYARI_TURU[u] === 'SERVIS');
    const parcaAz = (c.olcumParca ?? 101) <= PARCA_KRITIK;
    const sorun = [
      servis.length ? doldur(tt.fisSorun, { uyarilar: servis.map(uyariAdi).join(', ') }) : null,
      parcaAz ? doldur(tt.parcaSorun, { deger: parcaMetni(c) }) : null,
    ].filter(Boolean).join(' · ');
    const kategori = servis.map((u) => UYARI_KATEGORISI[u]).find(Boolean) ?? (parcaAz ? parcaKategorisi(c.parcaAd) : null);
    const q = new URLSearchParams({ cihaz: c.kod, sorun });
    if (kategori) q.set('kategori', kategori);
    return `/tickets/new?${q.toString()}`;
  };
  const durum = liste?.durum;
  const bilgisayarlar = liste?.bilgisayarlar ?? [];

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1100 }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>{tt.baslik}</h1>
      <p style={{ color: '#6b7280', margin: '0.3rem 0 1.25rem', maxWidth: 760 }}>{tt.alt}</p>

      {hata && <div role="alert" style={{ ...kart, background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>{hata}</div>}
      {bilgi && <div role="status" style={{ ...kart, background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}>{bilgi}</div>}

      {/* ── Cihaz durumu ── Bayinin her sabah bakacağı yer: hangi makine
          servis istiyor, hangisinin toneri bitiyor. Cihazın kendi söylediği;
          tahmin değil. */}
      {durum && durum.izlenen > 0 && (
        <section id="durum" style={kart}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>{tt.durumBaslik}</h2>
            <span style={{ fontSize: '0.82rem', color: '#0369a1', fontWeight: 600 }}>📡 {doldur(tt.izleniyor, { n: durum.izlenen })}</span>
          </div>
          {durum.cihazlar.length === 0 ? (
            <p style={{ margin: '0.7rem 0 0', color: '#166534', fontSize: '0.9rem' }}>✓ {tt.durumTemiz}</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: '0.8rem 0 0', padding: 0, display: 'grid', gap: '0.55rem' }}>
              {durum.cihazlar.map((c) => {
                const servis = c.uyarilar.some((u) => UYARI_TURU[u] === 'SERVIS');
                const sarf = c.uyarilar.some((u) => UYARI_TURU[u] === 'SARF')
                  || Math.min(c.olcumSiyah ?? 101, c.olcumRenkli ?? 101) <= TONER_KRITIK;
                const parcaAz = (c.olcumParca ?? 101) <= PARCA_KRITIK;
                const toner = tonerMetni(c.olcumSiyah, c.olcumRenkli);
                // Önem rengi rozetlerde ve düğmede; çerçeve yalnız hafif bir ton taşır.
                const kenar = servis ? '#fecaca' : sarf || parcaAz ? '#fde68a' : '#e5e7eb';
                return (
                  <li key={c.id} style={{ border: `1px solid ${kenar}`, borderRadius: 10, padding: '0.65rem 0.8rem', display: 'flex', justifyContent: 'space-between', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ minWidth: 0, flex: '1 1 320px' }}>
                      <div>
                        <Link href={`/devices/${c.id}`} style={{ color: '#111827', fontWeight: 700, textDecoration: 'none' }}>{c.etiket}</Link>
                        <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}> · {c.seri}</span>
                      </div>
                      <div style={{ color: '#6b7280', fontSize: '0.82rem' }}>
                        {c.musteri ? <Link href={`/customers/${c.musteri.id}`} style={{ color: '#1d4ed8', textDecoration: 'none' }}>{c.musteri.ad}</Link> : '—'}
                        {c.konum ? ` · ${c.konum}` : ''}
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.35rem', alignItems: 'center' }}>
                        {c.uyarilar.map((u) => <span key={u} style={rozet(TUR_RENGI[UYARI_TURU[u]] ?? TUR_RENGI.BILGI)}>{uyariAdi(u)}</span>)}
                        {c.uyarilar.length > 0 && c.uyariAt && <span style={{ fontSize: '0.76rem', color: '#6b7280' }}>{sure(c.uyariAt)}</span>}
                        {toner && <span style={{ fontSize: '0.78rem', color: sarf ? '#92400e' : '#4b5563', fontWeight: sarf ? 700 : 400 }}>{doldur(tt.tonerOlcum, { deger: toner })}</span>}
                        {parcaAz && <span style={{ fontSize: '0.78rem', color: '#92400e', fontWeight: 700 }}>{doldur(tt.parcaOlcum, { deger: parcaMetni(c) })}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {(servis || parcaAz) && (c.acikFis ? (
                        <Link href={`/tickets/${c.acikFis.id}`} style={{ padding: '0.4rem 0.75rem', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                          {doldur(tt.fisAcik, { no: c.acikFis.ticketNumber })}
                        </Link>
                      ) : (
                        <Link href={fisLinki(c)} style={{ padding: '0.4rem 0.75rem', background: '#dc2626', color: 'white', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                          {tt.fisAc}
                        </Link>
                      ))}
                      {sarf && (
                        <Link href="/sarf" style={{ padding: '0.4rem 0.75rem', border: '1px solid #fde68a', color: '#92400e', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                          {tt.tonerGonder}
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: '0.7rem 0 0' }}>{tt.durumNot}</p>
        </section>
      )}

      {/* ── İndir ── */}
      <section style={kart}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.5rem' }}>{tt.indirBaslik}</h2>
        <ol style={{ margin: '0 0 0.9rem', paddingLeft: '1.2rem', color: '#374151', fontSize: '0.9rem', lineHeight: 1.6 }}>
          {tt.adimlar.map((s: string) => <li key={s}>{s}</li>)}
        </ol>
        <button onClick={indir} disabled={mesgul || !ayar}
          style={{ padding: '0.6rem 1.1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: mesgul ? 'default' : 'pointer', opacity: mesgul ? 0.6 : 1 }}>
          {ayar?.anahtarVar ? tt.yeniIndir : tt.indir}
        </button>
        <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0.6rem 0 0' }}>{tt.neYapmaz}</p>
      </section>

      {/* ── Otomatik ── */}
      <section style={kart}>
        <label style={{ display: 'flex', gap: '0.7rem', alignItems: 'flex-start', cursor: 'pointer' }}>
          <input type="checkbox" checked={Boolean(ayar?.otomatik)} disabled={mesgul || !ayar}
            onChange={(e) => otomatikDegistir(e.target.checked)} style={{ marginTop: 4, width: 18, height: 18 }} />
          <span>
            <strong style={{ display: 'block' }}>{tt.otomatikBaslik}</strong>
            <span style={{ fontSize: '0.87rem', color: '#4b5563' }}>{tt.otomatikAciklama}</span>
          </span>
        </label>
        <label style={{ display: 'flex', gap: '0.7rem', alignItems: 'flex-start', cursor: 'pointer', marginTop: '0.9rem', paddingTop: '0.9rem', borderTop: '1px solid #f3f4f6' }}>
          <input type="checkbox" checked={Boolean(ayar?.otomatikFis)} disabled={mesgul || !ayar}
            onChange={(e) => otomatikFisDegistir(e.target.checked)} style={{ marginTop: 4, width: 18, height: 18 }} />
          <span>
            <strong style={{ display: 'block' }}>{tt.otomatikFisBaslik}</strong>
            <span style={{ fontSize: '0.87rem', color: '#4b5563' }}>{tt.otomatikFisAciklama}</span>
          </span>
        </label>
      </section>

      {/* ── Tarayan bilgisayarlar ── Susan tarayıcı = duran sayaç; bayi bunu
          fatura günü değil ilk sessiz günde görmeli. */}
      {bilgisayarlar.length > 0 && (
        <section style={kart}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.6rem' }}>{tt.bilgisayarBaslik}</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', minWidth: 560 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>
                  {tt.bilgisayarSutun.map((s: string) => <th key={s} style={{ padding: '0.4rem 0.5rem', fontWeight: 600 }}>{s}</th>)}
                </tr>
              </thead>
              <tbody>
                {bilgisayarlar.map((g) => {
                  const gun = Math.floor((Date.now() - new Date(g.sonTarama).getTime()) / GUN_MS);
                  return (
                    <tr key={g.bilgisayar ?? '—'} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.45rem 0.5rem', fontWeight: 600 }}>{g.bilgisayar ?? '—'}</td>
                      <td style={{ padding: '0.45rem 0.5rem', whiteSpace: 'nowrap' }}>{b.tarihSaat(g.sonTarama)}</td>
                      <td style={{ padding: '0.45rem 0.5rem' }}>{doldur(tt.yaziciSayisi, { n: g.sonBulunan })}</td>
                      <td style={{ padding: '0.45rem 0.5rem' }}>{doldur(tt.haftalik, { n: g.haftalik })}</td>
                      <td style={{ padding: '0.45rem 0.5rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <span style={rozet(g.sessiz ? TUR_RENGI.SERVIS : { bg: '#d1fae5', fg: '#065f46' })}>
                          {g.sessiz ? doldur(tt.sessiz, { n: gun }) : tt.calisiyor}
                        </span>
                        {g.eski && <span style={rozet(TUR_RENGI.SARF)}>{tt.eskiSurum}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {bilgisayarlar.some((g) => g.sessiz) && <p style={{ fontSize: '0.8rem', color: '#991b1b', margin: '0.6rem 0 0' }}>{tt.sessizNot}</p>}
          {bilgisayarlar.some((g) => g.eski) && <p style={{ fontSize: '0.8rem', color: '#92400e', margin: '0.4rem 0 0' }}>{tt.eskiNot}</p>}
        </section>
      )}

      {/* ── Taramalar ── */}
      <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '1.5rem 0 0.6rem' }}>{tt.taramalar}</h2>
      {!liste ? (
        <p style={{ color: '#9ca3af' }}>{t.genel.yukleniyor}</p>
      ) : liste.taramalar.length === 0 ? (
        <div style={{ ...kart, borderStyle: 'dashed', color: '#6b7280', textAlign: 'center' }}>{tt.bos}</div>
      ) : liste.taramalar.map((tr) => (
        <section key={tr.id} style={kart}>
          <button type="button" onClick={() => setAcik(acik === tr.id ? null : tr.id)} aria-expanded={acik === tr.id}
            style={{ all: 'unset', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: '1rem', width: '100%', flexWrap: 'wrap' }}>
            <span>
              <strong>{b.tarihSaat(tr.createdAt)}</strong>
              {tr.bilgisayar && <span style={{ color: '#6b7280' }}> · {tr.bilgisayar}</span>}
            </span>
            <span style={{ fontSize: '0.85rem', color: '#374151' }}>
              {doldur(tt.ozet, { bulunan: tr.bulunan, eslesen: tr.eslesen, yazilan: tr.yazilan })}
              {' · '}
              <span style={{ fontWeight: 700, color: tr.onaylandiAt ? '#065f46' : tr.yazilabilir ? '#1e40af' : '#6b7280' }}>
                {tr.onaylandiAt ? tt.onaylandi : tr.yazilabilir ? doldur(tt.onayBekliyor, { n: tr.yazilabilir }) : tt.yazilacakYok}
              </span>
            </span>
          </button>

          {acik === tr.id && (
            <>
              {!tr.onaylandiAt && tr.yazilabilir > 0 && (
                <div style={{ margin: '0.9rem 0 0.4rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button onClick={() => onayla(tr.id)} disabled={mesgul}
                    style={{ padding: '0.5rem 1rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                    {doldur(tt.kaydet, { n: tr.yazilabilir })}
                  </button>
                  <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{tt.kaydetNot}</span>
                </div>
              )}
              {ekleKutusu(tr)}
              <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem', minWidth: 760 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>
                      {tt.sutun.map((s: string) => <th key={s} style={{ padding: '0.45rem 0.5rem', fontWeight: 600 }}>{s}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {tr.sonuc.map((s, i) => {
                      const c = s.deviceId ? liste.cihazlar[s.deviceId] : null;
                      const renk = s.eklendi ? RENK.YAZILDI : RENK[s.durum] ?? RENK.DEGISMEDI;
                      const toner = s.sarf.filter((x) => x.yuzde !== null).map((x) => x.yuzde as number);
                      const aday = s.durum === 'ESLESMEDI' && !s.deviceId && s.seri;
                      return (
                        <tr key={`${s.ip}-${i}`} style={{ borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' }}>
                          <td style={{ padding: '0.5rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                              {aday && (
                                <input type="checkbox" aria-label={tt.ekleSec} disabled={mesgul}
                                  checked={!(cikarilan[tr.id] ?? []).includes(s.seri as string)}
                                  onChange={(e) => isaretDegistir(tr.id, s.seri as string, e.target.checked)}
                                  style={{ marginTop: 3, width: 16, height: 16 }} />
                              )}
                              <div>
                                <div style={{ fontWeight: 600 }}>{cihazAdi(s.marka, s.model)}</div>
                                <div style={{ color: '#9ca3af' }}>{s.ip}{s.seri ? ` · ${s.seri}` : ''}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            {c ? (
                              <>
                                <Link href={`/devices/${s.deviceId}`} style={{ color: '#1d4ed8', fontWeight: 600, textDecoration: 'none' }}>{c.etiket}</Link>
                                <div style={{ color: '#9ca3af' }}>{c.musteri ?? '—'}</div>
                              </>
                            ) : <span style={{ color: '#9ca3af' }}>—</span>}
                          </td>
                          <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>
                            {s.siyah !== null ? (
                              <>
                                <div>{tt.sb} {b.sayi(s.siyah)} <span style={{ color: '#6b7280' }}>({fark(s.siyah, s.sonSiyah)})</span></div>
                                <div>{tt.renkli} {b.sayi(s.renkli)} <span style={{ color: '#6b7280' }}>({fark(s.renkli, s.sonRenkli)})</span></div>
                              </>
                            ) : s.toplam !== null ? (
                              <div>{tt.toplam} {b.sayi(s.toplam)}</div>
                            ) : '—'}
                          </td>
                          <td style={{ padding: '0.5rem', whiteSpace: 'nowrap', color: '#4b5563' }}>
                            {s.sonSiyah !== null ? <>{tt.sb} {b.sayi(s.sonSiyah)}<br />{tt.renkli} {b.sayi(s.sonRenkli)}</> : '—'}
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            <span style={{ background: renk.bg, color: renk.fg, padding: '0.15rem 0.55rem', borderRadius: 999, fontWeight: 700, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                              {s.eklendi ? tt.eklendi : (tt.durum as Record<string, string>)[s.durum] ?? s.durum}
                            </span>
                            {(s.sebep || s.durum === 'GERILEDI' || s.hataKodu) && (
                              <div style={{ color: '#6b7280', marginTop: 4, maxWidth: 260 }}>
                                {s.sebep ? (tt.sebep as Record<string, string>)[s.sebep] ?? s.sebep
                                  : s.durum === 'GERILEDI' ? tt.gerilediNot : s.hataKodu}
                              </div>
                            )}
                            {(s.uyarilar?.length ?? 0) > 0 && (
                              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: 5 }}>
                                {s.uyarilar!.map((u) => <span key={u} style={rozet(TUR_RENGI[UYARI_TURU[u]] ?? TUR_RENGI.BILGI)}>{uyariAdi(u)}</span>)}
                              </div>
                            )}
                            {s.tonerDegisti && <div style={{ color: '#065f46', marginTop: 4, fontWeight: 600 }}>✓ {tt.tonerDegisti}</div>}
                            {s.fisAcildi && <div style={{ color: '#991b1b', marginTop: 4, fontWeight: 600 }}>{doldur(tt.fisAcildi, { no: s.fisAcildi })}</div>}
                          </td>
                          <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>
                            {s.olcum && (s.olcum.siyah != null || s.olcum.renkli != null)
                              ? tonerMetni(s.olcum.siyah, s.olcum.renkli)
                              : toner.length ? b.yuzde(Math.min(...toner)) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      ))}
    </div>
  );
}
