'use client';

/**
 * "VARDIM / ÇIKTIM" — fiş ekranının en üstünde, telefonda başparmak boyunda.
 *
 * Teknisyen müşterinin kapısında fişi açar, tek dokunuşla "Vardım" der;
 * çıkarken "Çıktım". Arada "Sahada 42 dk" canlı sayar. Konum ALINMAZ.
 * Kim basabilir: atanan teknisyen ya da yönetici. Ötekiler yalnız okur.
 * Yanlış basılan son adımı yönetici geri alır (fişin durumu değişmez).
 *
 * Saat ve süre yalnız tarayıcıda yazılır: sunucunun saat dilimi bayininkiyle
 * aynı değil, sunucuda yazılan "09:14" tarayıcıda "12:14" olurdu.
 */
import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';
import { sahaDakikasi, sureParcala, sahaYetkisi } from '@/lib/saha-suresi';

interface Props {
  ticketId: string;
  status: string;
  varisAt: string | null;
  ayrilisAt: string | null;
  atananId: string | null;
  atananAdi: string | null;
  benimId: string;
  rol: string;
}

// 30 saniyede bir tıklayan saat. Sunucuda 0: süre yazılmaz.
const ADIM = 30_000;
const saatAbone = (cb: () => void) => { const i = setInterval(cb, ADIM); return () => clearInterval(i); };
const saatOku = () => Math.floor(Date.now() / ADIM) * ADIM;

export default function SahaKarti({ ticketId, status, varisAt: ilkVaris, ayrilisAt: ilkAyrilis, atananId, atananAdi, benimId, rol }: Props) {
  const t = useT();
  const z = t.sahaSuresi;
  const b = useBicim();
  const router = useRouter();
  const simdi = useSyncExternalStore(saatAbone, saatOku, () => 0);
  const [varisAt, setVarisAt] = useState(ilkVaris);
  const [ayrilisAt, setAyrilisAt] = useState(ilkAyrilis);
  const [bekliyor, setBekliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const yonetici = rol === 'ADMIN' || rol === 'SUPER_ADMIN';
  const yetkili = sahaYetkisi({ assignedUserId: atananId }, { id: benimId, role: rol });

  if (status === 'CANCELLED') return null;
  // Kapanmış ve varışı hiç yazılmamış fişte geriye dönük "Vardım" yok.
  if (!varisAt && status === 'DELIVERED') return null;
  if (!yetkili && !varisAt) return null;

  const sure = (dk: number) => {
    const { saat, dakika } = sureParcala(dk);
    if (!saat) return doldur(z.sureDk, { dk: dakika });
    return dakika ? doldur(z.sureSaDk, { sa: saat, dk: dakika }) : doldur(z.sureSa, { sa: saat });
  };
  const saatMetni = (iso: string) => new Date(iso).toLocaleTimeString(b.dil === 'en' ? 'en-GB' : 'tr-TR', { hour: '2-digit', minute: '2-digit' });
  const dk = simdi ? sahaDakikasi(varisAt, ayrilisAt, new Date(simdi)) : null;

  const bas = async (islem: 'vardim' | 'ciktim' | 'geriAl') => {
    if (islem === 'geriAl' && !window.confirm(z.geriAlSor)) return;
    setBekliyor(true);
    setHata(null);
    try {
      const r = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}/saha`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ islem }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) { setHata(d?.error || t.genel.hata); return; }
      setVarisAt(d?.varisAt ?? null);
      setAyrilisAt(d?.ayrilisAt ?? null);
      // "Vardım" fişi Serviste'ye almış olabilir: başlıktaki durum da yenilensin.
      router.refresh();
    } catch {
      setHata(t.genel.baglantiHatasi);
    } finally {
      setBekliyor(false);
    }
  };

  const buyuk: React.CSSProperties = { width: '100%', minHeight: 56, fontSize: '1.1rem', borderRadius: 14 };

  // Başkasının işi: yalnız bilgi.
  if (!yetkili) {
    return (
      <section className="card" style={{ marginBottom: '1rem', padding: '0.85rem 1.1rem' }}>
        <span style={{ color: '#33405C', fontSize: '0.92rem' }}>
          {dk === null ? '📍' : `📍 ${doldur(ayrilisAt ? z.kimdeBitti : z.kimdeSahada, { ad: atananAdi ?? '—', sure: sure(dk) })}`}
        </span>
      </section>
    );
  }

  return (
    <section className="card" style={{ marginBottom: '1rem' }} aria-labelledby="saha-baslik">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        <h2 id="saha-baslik" style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }}>{z.baslik}</h2>
        {varisAt && simdi > 0 && (
          <span style={{ color: '#6C7A93', fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums' }}>
            {ayrilisAt ? `${saatMetni(varisAt)} → ${saatMetni(ayrilisAt)}` : doldur(z.varis, { saat: saatMetni(varisAt) })}
          </span>
        )}
      </div>

      {varisAt && dk !== null && (
        <div role="status" style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.4rem 0 0.2rem', color: ayrilisAt ? '#0F1E33' : '#0B8259', fontVariantNumeric: 'tabular-nums' }}>
          {doldur(z.sahada, { sure: sure(dk) })}
        </div>
      )}

      {!varisAt && (
        <>
          <p style={{ color: '#53617B', fontSize: '0.88rem', margin: '0.35rem 0 0.75rem', lineHeight: 1.5 }}>{z.vardimAlt}</p>
          <button type="button" onClick={() => bas('vardim')} disabled={bekliyor} className="btn-primary" style={buyuk}>
            {bekliyor ? t.genel.kaydediliyor : z.vardim}
          </button>
        </>
      )}

      {varisAt && !ayrilisAt && (
        <>
          <p style={{ color: '#53617B', fontSize: '0.88rem', margin: '0.2rem 0 0.75rem' }}>{z.ciktimAlt}</p>
          <button type="button" onClick={() => bas('ciktim')} disabled={bekliyor} className="btn-primary" style={{ ...buyuk, background: bekliyor ? undefined : '#0B8259' }}>
            {bekliyor ? t.genel.kaydediliyor : z.ciktim}
          </button>
        </>
      )}

      {yonetici && varisAt && (
        <button type="button" onClick={() => bas('geriAl')} disabled={bekliyor}
          style={{ marginTop: '0.6rem', minHeight: 44, background: 'transparent', border: 0, color: '#6C7A93', fontSize: '0.82rem', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>
          {z.geriAl}
        </button>
      )}

      {hata && <p role="alert" style={{ color: '#B93333', fontSize: '0.85rem', margin: '0.6rem 0 0' }}>{hata}</p>}
    </section>
  );
}
