'use client';

/**
 * ABONELİK — bayinin kendi paketi, tutarı, faturaları ve nasıl ödeneceği.
 *
 * Eskiden bayi abonelik faturasını hiç göremiyordu; deneme bitince kilit
 * ekranında yalnız bir e-posta vardı. Satın almaya hazır bayi satın almanın
 * yolunu bulamıyordu. Bu ekran o yolu tek yerde topluyor.
 *
 * Tutarlar sunucudan (faturayı kesen fonksiyondan); cümleler burada.
 */
import type { AmountBreakdown } from '@/lib/plan-pricing';
import { useEffect, useState } from 'react';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

// Tutar tipi fiyatın tek kaynağından: ekran hesapla ayrışmasın.
type Tutar = AmountBreakdown;
interface Fatura { id: string; invoiceNumber: string; period: string; totalAmount: number; status: string; dueDate: string; paidDate: string | null }
interface Veri {
  bayi: string; plan: string | null; denemeKalanGun: number | null;
  trialEndsAt: string | null; planEndDate: string | null; faturaliCihaz: number;
  tutarPaketi: string; aylik: Tutar;
  paketler: Record<string, { base: number; includedDevices: number; perDevice: number; ceiling: number; aylik: number }>;
  faturalar: Fatura[];
  odeme: { iban: string | null; hesapAdi: string | null; whatsapp: string | null };
}

const kart: React.CSSProperties = { background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1.1rem 1.25rem', marginBottom: '1rem' };
const DURUM_RENK: Record<string, { bg: string; fg: string }> = {
  paid: { bg: '#d1fae5', fg: '#065f46' },
  pending: { bg: '#fef3c7', fg: '#92400e' },
  overdue: { bg: '#fee2e2', fg: '#991b1b' },
};

function KopyaSatiri({ etiket, deger, kopyala, kopyalandi, bosluksuz }: { etiket: string; deger: string; kopyala: string; kopyalandi: string; bosluksuz?: boolean }) {
  const [tamam, setTamam] = useState(false);
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', padding: '0.45rem 0', borderBottom: '1px solid #f3f4f6' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600 }}>{etiket}</div>
        <div style={{ fontFamily: 'monospace', fontSize: '0.92rem', wordBreak: 'break-all' }}>{deger}</div>
      </div>
      <button type="button"
        onClick={async () => { try { await navigator.clipboard.writeText(bosluksuz ? deger.replace(/\s/g, '') : deger); setTamam(true); setTimeout(() => setTamam(false), 1800); } catch { /* pano izni yok */ } }}
        style={{ flexShrink: 0, padding: '0.35rem 0.75rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
        {tamam ? kopyalandi : kopyala}
      </button>
    </div>
  );
}

export default function AbonelikPage() {
  const t = useT();
  const a = t.abonelik;
  const b = useBicim();
  const [v, setV] = useState<Veri | null>(null);
  const [hata, setHata] = useState(false);

  useEffect(() => {
    fetch('/api/abonelik').then((r) => (r.ok ? r.json() : Promise.reject())).then(setV).catch(() => setHata(true));
  }, []);

  if (hata) return <div style={{ padding: '2rem', color: '#b91c1c' }}>{a.yuklenemedi}</div>;
  if (!v) return <div style={{ padding: '2rem', color: '#6b7280' }}>{t.genel.yukleniyor}</div>;

  const paketAdi = (k: string | null) => (t.superAdmin.paket as Record<string, string>)[k ?? ''] ?? k ?? '—';
  const deneme = v.denemeKalanGun !== null;
  const odenmemis = v.faturalar.filter((f) => f.status === 'pending' || f.status === 'overdue');
  // Havale açıklaması: ödenmemiş en eski faturanın numarası; yoksa bayinin adı.
  const aciklama = odenmemis.length ? odenmemis[odenmemis.length - 1].invoiceNumber : v.bayi;
  const wa = (mesaj: string) => v.odeme.whatsapp ? `https://wa.me/${v.odeme.whatsapp}?text=${encodeURIComponent(mesaj)}` : null;
  const devamLinki = wa(doldur(a.waDevam, { bayi: v.bayi, paket: paketAdi(v.tutarPaketi) }));
  const degisLinki = wa(doldur(a.waDegis, { bayi: v.bayi }));

  return (
    <div style={{ padding: '1.5rem', maxWidth: 900 }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>{a.baslik}</h1>
      <p style={{ color: '#6b7280', margin: '0.3rem 0 1.25rem' }}>{a.alt}</p>

      {/* ── Paket ve deneme ── */}
      <section style={{ ...kart, ...(deneme ? { background: v.denemeKalanGun! <= 3 ? '#fef2f2' : '#fffbeb', borderColor: v.denemeKalanGun! <= 3 ? '#fecaca' : '#fde68a' } : {}) }}>
        <div style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 600 }}>{a.paketiniz}</div>
        <div style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0.15rem 0' }}>{paketAdi(v.plan)}</div>
        {deneme && (
          <>
            <div style={{ fontWeight: 600, color: v.denemeKalanGun! <= 3 ? '#991b1b' : '#92400e' }}>
              {v.denemeKalanGun === 0 ? a.denemeBugun : doldur(a.denemeKalan, { n: v.denemeKalanGun! })}
            </div>
            <p style={{ fontSize: '0.87rem', color: '#4b5563', margin: '0.4rem 0 0.8rem' }}>{a.denemeNot}</p>
            {devamLinki ? (
              <a href={devamLinki} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-block', padding: '0.6rem 1.1rem', background: '#16a34a', color: 'white', borderRadius: 10, fontWeight: 700, textDecoration: 'none' }}>
                {doldur(a.devamEt, { paket: paketAdi(v.tutarPaketi) })}
              </a>
            ) : <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>{a.iletisimYok}</span>}
          </>
        )}
        {!deneme && v.planEndDate && (
          <div style={{ fontSize: '0.85rem', color: '#4b5563' }}>{doldur(a.bitis, { tarih: b.tarih(v.planEndDate) })}</div>
        )}
      </section>

      {/* ── Aylık tutar ── */}
      <section style={kart}>
        <div style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 600 }}>
          {deneme ? doldur(a.tutarDenemede, { paket: paketAdi(v.tutarPaketi) }) : a.tutarBaslik}
        </div>
        <div style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.2rem 0' }}>
          {b.para(v.aylik.amount)} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#6b7280' }}>{a.kdvHaric}</span>
        </div>
        <div style={{ fontSize: '0.87rem', color: '#4b5563', lineHeight: 1.6 }}>
          {doldur(a.dokumTaban, { taban: b.para(v.aylik.base), dahil: v.aylik.includedDevices })}
          {v.aylik.billableDevices > 0 && <><br />{doldur(a.dokumAsim, { n: v.aylik.billableDevices, birim: b.para(v.aylik.perDevice), tutar: b.para(v.aylik.overage) })}</>}
          {v.aylik.capped && <><br /><b>{doldur(a.dokumTavan, { tavan: b.para(v.aylik.ceiling) })}</b></>}
          <br />{doldur(a.cihazSayisi, { n: v.faturaliCihaz })}
        </div>
      </section>

      {/* ── Paketler ── */}
      <section style={kart}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{doldur(a.paketlerBaslik, { n: v.faturaliCihaz })}</h2>
          {degisLinki && <a href={degisLinki} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem', color: '#1d4ed8', fontWeight: 600 }}>{a.paketDegis}</a>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
          {(['starter', 'professional', 'enterprise'] as const).map((k) => {
            const p = v.paketler[k];
            const buPaket = (v.plan === k) || (deneme && k === 'professional');
            return p ? (
              <div key={k} style={{ border: `1px solid ${buPaket ? '#2563eb' : '#e5e7eb'}`, borderRadius: 10, padding: '0.8rem 0.9rem', background: buPaket ? '#eff6ff' : 'white' }}>
                <div style={{ fontWeight: 700 }}>{paketAdi(k)}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0.2rem 0' }}>{b.para(p.aylik)}<span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}> {a.ayda}</span></div>
                <div style={{ fontSize: '0.8rem', color: '#4b5563', lineHeight: 1.5 }}>{(a.paketFark as Record<string, string>)[k]}</div>
              </div>
            ) : null;
          })}
        </div>
        <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: '0.6rem 0 0' }}>{a.yillikNot}</p>
      </section>

      {/* ── Faturalar ── */}
      <section style={kart}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.6rem' }}>{a.faturalar}</h2>
        {v.faturalar.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '0.88rem', margin: 0 }}>{deneme ? a.faturaYokDeneme : a.faturaYok}</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem', minWidth: 480 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>
                  {a.sutun.map((s: string) => <th key={s} style={{ padding: '0.4rem 0.5rem', fontWeight: 600 }}>{s}</th>)}
                </tr>
              </thead>
              <tbody>
                {v.faturalar.map((f) => {
                  const r = DURUM_RENK[f.status] ?? { bg: '#f3f4f6', fg: '#4b5563' };
                  return (
                    <tr key={f.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.5rem' }}>{f.period}</td>
                      <td style={{ padding: '0.5rem', fontFamily: 'monospace' }}>{f.invoiceNumber}</td>
                      <td style={{ padding: '0.5rem' }}>{b.para(f.totalAmount)}</td>
                      <td style={{ padding: '0.5rem' }}>{b.tarih(f.dueDate)}</td>
                      <td style={{ padding: '0.5rem' }}>
                        <span style={{ background: r.bg, color: r.fg, padding: '0.12rem 0.55rem', borderRadius: 999, fontWeight: 700, fontSize: '0.75rem' }}>
                          {(a.durum as Record<string, string>)[f.status] ?? f.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Nasıl ödenir ── */}
      <section style={kart}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.4rem' }}>{a.nasilOdenir}</h2>
        {v.odeme.iban ? (
          <>
            <KopyaSatiri etiket={a.iban} deger={v.odeme.iban} kopyala={a.kopyala} kopyalandi={a.kopyalandi} bosluksuz />
            {v.odeme.hesapAdi && <KopyaSatiri etiket={a.alici} deger={v.odeme.hesapAdi} kopyala={a.kopyala} kopyalandi={a.kopyalandi} />}
            <KopyaSatiri etiket={a.aciklama} deger={aciklama} kopyala={a.kopyala} kopyalandi={a.kopyalandi} />
            <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0.6rem 0 0' }}>{odenmemis.length ? a.aciklamaNotFatura : a.aciklamaNotBayi}</p>
          </>
        ) : (
          <p style={{ fontSize: '0.88rem', color: '#4b5563', margin: 0 }}>{a.odemeBilgisiYok}</p>
        )}
      </section>
    </div>
  );
}
