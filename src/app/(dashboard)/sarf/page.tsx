'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ContactActions from '@/components/ContactActions';
import { useT, useBicim, useMusteriDili } from '@/lib/i18n/client';
import { doldur, type Sozluk } from '@/lib/i18n/sozluk';
import type { Bicimleyici } from '@/lib/bicim';

interface Forecast {
  channel: string; yield: number; remaining: number | null; remainingPct: number | null;
  daysLeft: number | null; dailyRate: number | null; needsSetup: boolean;
}
interface Item {
  id: string; brand: string; model: string; serialNo: string; location: string | null;
  customer: { id: string; name: string; phone: string; address: string | null } | null;
  tonerChangedAt: string | null;
  black: Forecast | null; color: Forecast | null;
  soonestDaysLeft: number | null; needsSetup: boolean;
  // Verimin nereden geldiği — ölçülmüş bir sayıyla elle girilmiş bir
  // sayı aynı güvende değil ve bayi hangisine baktığını bilmeli.
  verimSb?: { deger: number | null; kaynak: string | null; gozlem: number; aciklama: string };
  verimRenkli?: { deger: number | null; kaynak: string | null; gozlem: number; aciklama: string };
  /** Nextus Mağaza sipariş bağlantısı — mağaza kurulu ve müşteri paneli açıksa dolu. */
  magazaLink?: string | null;
}

function sev(days: number | null): { border: string; bar: string; text: string } {
  if (days == null) return { border: '#e5e7eb', bar: '#94a3b8', text: '#6b7280' };
  if (days <= 7) return { border: '#fecaca', bar: '#dc2626', text: '#b91c1c' };
  if (days <= 14) return { border: '#fde68a', bar: '#d97706', text: '#92400e' };
  return { border: '#bbf7d0', bar: '#059669', text: '#15803d' };
}

function ChannelLine({ f, name, t, b }: { f: Forecast | null; name: string; t: Sozluk; b: Bicimleyici }) {
  if (!f) return null;
  let txt: string;
  if (f.needsSetup) txt = t.sarf.bekliyor;
  else if (f.daysLeft == null) txt = doldur(t.sarf.gunTahminiYok, { yuzde: f.remainingPct ?? 0 });
  else txt = doldur(t.sarf.gunSonra, { gun: f.daysLeft, yuzde: f.remainingPct ?? 0, kalan: b.sayi(f.remaining ?? 0) });
  const s = sev(f.needsSetup ? null : f.daysLeft);
  return (
    <div style={{ fontSize: '0.83rem', color: s.text, fontWeight: 600, marginTop: 3 }}>
      {name}: {txt}
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
  const gun =
    i.soonestDaysLeft != null && !i.needsSetup
      ? doldur(mt.sarf.mesajGun, { cihaz, gun: i.soonestDaysLeft })
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/toner').then((r) => r.json()).then((d) => {
      setItems(Array.isArray(d.items) ? d.items : []);
      setTracked(d.trackedCount || 0);
      setUrgent(d.urgent || 0);
      setOlculen(d.olculen || 0);
      setBilinmeyen(d.bilinmeyen || 0);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

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
            const s = sev(i.needsSetup ? null : i.soonestDaysLeft);
            return (
              <div key={i.id} style={{ background: 'white', border: `1px solid ${s.border}`, borderLeft: `4px solid ${s.bar}`, borderRadius: 12, padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{i.brand} {i.model} <span style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 400 }}>· SN {i.serialNo}</span></div>
                    <div style={{ fontSize: '0.85rem', color: '#374151', marginTop: 2 }}>
                      👤 {i.customer ? <Link href={`/customers/${i.customer.id}`} style={{ color: '#1d4ed8', textDecoration: 'none' }}>{i.customer.name}</Link> : '—'}
                      {i.location ? ` · ${i.location}` : ''}
                    </div>
                    <ChannelLine f={i.black} name={t.sarf.siyah} t={t} b={b} />
                    <ChannelLine f={i.color} name={t.sarf.renkli} t={t} b={b} />
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
        </div>
      )}
    </div>
  );
}
