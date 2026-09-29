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

type Durum = 'YAZILABILIR' | 'YAZILDI' | 'DEGISMEDI' | 'GERILEDI' | 'ESLESMEDI' | 'BIRDEN_FAZLA' | 'AYRIM_YOK' | 'SAYAC_YOK' | 'HATA';

interface Sonuc {
  ip: string; marka: string | null; model: string | null; seri: string | null;
  deviceId: string | null; toplam: number | null;
  siyah: number | null; renkli: number | null;
  ayrim: 'TEK_RENK' | 'DOGRULANDI' | 'YOK'; sebep: string | null;
  sonSiyah: number | null; sonRenkli: number | null;
  durum: Durum; hataKodu?: string | null;
  sarf: { ad: string; yuzde: number | null }[];
}
interface Tarama {
  id: string; createdAt: string; bilgisayar: string | null; taranan: number;
  bulunan: number; eslesen: number; yazilabilir: number; yazilan: number;
  sonuc: Sonuc[]; onaylandiAt: string | null;
}
interface Liste { taramalar: Tarama[]; cihazlar: Record<string, { etiket: string; seri: string; musteri: string | null }> }

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

export default function SayacTarayiciPage() {
  const t = useT();
  const tt = t.tarayici;
  const b = useBicim();
  const { dil } = useDil();
  const [ayar, setAyar] = useState<{ anahtarVar: boolean; otomatik: boolean } | null>(null);
  const [liste, setListe] = useState<Liste | null>(null);
  const [acik, setAcik] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);

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

  const onayla = async (id: string) => {
    setMesgul(true); setHata(null); setBilgi(null);
    const r = await fetch(`/api/sayac/tarayici/${id}`, { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setHata(j.error ?? tt.kaydedilemedi);
    else setBilgi(doldur(tt.kaydedildi, { n: j.ozet?.yazilan ?? 0 }));
    await yukle();
    setMesgul(false);
  };

  const fark = (yeni: number | null, eski: number | null) =>
    yeni === null ? '—' : eski === null ? tt.ilkOkuma : `${yeni - eski >= 0 ? '+' : ''}${b.sayi(yeni - eski)}`;

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1100 }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>{tt.baslik}</h1>
      <p style={{ color: '#6b7280', margin: '0.3rem 0 1.25rem', maxWidth: 760 }}>{tt.alt}</p>

      {hata && <div role="alert" style={{ ...kart, background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>{hata}</div>}
      {bilgi && <div role="status" style={{ ...kart, background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}>{bilgi}</div>}

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
      </section>

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
                      const renk = RENK[s.durum] ?? RENK.DEGISMEDI;
                      const toner = s.sarf.filter((x) => x.yuzde !== null).map((x) => x.yuzde as number);
                      return (
                        <tr key={`${s.ip}-${i}`} style={{ borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' }}>
                          <td style={{ padding: '0.5rem' }}>
                            <div style={{ fontWeight: 600 }}>{[s.marka, s.model].filter(Boolean).join(' ') || '—'}</div>
                            <div style={{ color: '#9ca3af' }}>{s.ip}{s.seri ? ` · ${s.seri}` : ''}</div>
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
                              {(tt.durum as Record<string, string>)[s.durum] ?? s.durum}
                            </span>
                            {(s.sebep || s.durum === 'GERILEDI' || s.hataKodu) && (
                              <div style={{ color: '#6b7280', marginTop: 4, maxWidth: 260 }}>
                                {s.sebep ? (tt.sebep as Record<string, string>)[s.sebep] ?? s.sebep
                                  : s.durum === 'GERILEDI' ? tt.gerilediNot : s.hataKodu}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>
                            {toner.length ? b.yuzde(Math.min(...toner)) : '—'}
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
