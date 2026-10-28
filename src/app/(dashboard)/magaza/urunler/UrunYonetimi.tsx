'use client';

import { useEffect, useState } from 'react';
import { bicimYap } from '@/lib/bicim';
import { useDil } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';
import { magazaSiparisMetni, type MagazaSiparisMetni } from '@/lib/magaza-siparis-metin';
import { KIRMIZI, MAVI, YESIL, dugme, kodMetni } from '../siparis-ortak';

/**
 * ÜRÜNLER VE STOK — mağazadaki ürünlerin fiyatı ve yayını, Servis'in içinden.
 *
 * Günlük iş: fiyatsız ürüne fiyat girip yayına almak. Kural mağazada
 * (nextus-magaza lib/urun-kaydet.ts): fiyatsız ürün yayınlanmaz, yayındaki
 * ürünün fiyatı silinirse taslağa düşer — mesaj olduğu gibi gösterilir.
 * Stok bağlı ürünlerde Servis deposundan gelir. Toplu işler mağaza panelinde.
 */
type Durum = 'YAYINDA' | 'TASLAK' | 'ARSIV';
interface Urun {
  id: string;
  ad: string;
  sku: string;
  durum: Durum;
  fiyat: number | null;
  paraBirimi: string;
  kdvOrani: number;
  stok: number | null;
  stokDurumu: 'STOKTA' | 'AZ' | 'TUKENDI' | 'TEDARIK' | 'BILINMIYOR';
  bagli: boolean;
  gorsel: string | null;
  vitrin: string | null;
}
interface Liste {
  sayfa: number;
  sayfaSayisi: number;
  toplam: number;
  sayilar: Record<string, number>;
  urunler: Urun[];
}

const FILTRELER: { f: string; ad: keyof MagazaSiparisMetni }[] = [
  { f: 'HEPSI', ad: 'uHepsi' },
  { f: 'FIYATSIZ', ad: 'uFiyatsiz' },
  { f: 'YAYINDA', ad: 'uYayinda' },
  { f: 'TASLAK', ad: 'uTaslak' },
];

async function listeGetir(filtre: string, q: string, sayfa: number): Promise<{ veri: Liste } | { kod: string }> {
  try {
    const p = new URLSearchParams({ filtre, q, sayfa: String(sayfa) });
    const r = await fetch(`/api/magaza/urunler?${p.toString()}`, { cache: 'no-store' });
    const g = (await r.json().catch(() => null)) as (Liste & { ok?: boolean; kod?: string }) | null;
    if (!r.ok || !g || g.ok === false) return { kod: g?.kod ?? 'GENEL' };
    return { veri: g };
  } catch {
    return { kod: 'ULASILAMADI' };
  }
}

/** Yalnız ipucu için (KDV dahil karşılığı); asıl ayrıştırma mağazada. */
function sayiyaCevir(ham: string): number | null {
  const t = ham.trim().replace(/\s/g, '');
  if (!t) return null;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function UrunYonetimi({ ilkFiltre }: { ilkFiltre: string }) {
  const { dil } = useDil();
  const sm = magazaSiparisMetni(dil);
  const [filtre, setFiltre] = useState(FILTRELER.some((x) => x.f === ilkFiltre) ? ilkFiltre : 'HEPSI');
  const [arama, setArama] = useState('');
  const [sorgu, setSorgu] = useState('');
  const [sayfa, setSayfa] = useState(1);
  const [liste, setListe] = useState<Liste | null>(null);
  const [kod, setKod] = useState<string | null>(null);

  // Yazarken her harfte istek gitmesin.
  useEffect(() => {
    const z = window.setTimeout(() => setSorgu(arama.trim()), 300);
    return () => window.clearTimeout(z);
  }, [arama]);

  useEffect(() => {
    let iptal = false;
    void listeGetir(filtre, sorgu, sayfa).then((r) => {
      if (iptal) return;
      if ('kod' in r) return setKod(r.kod);
      setKod(null);
      // Sonraki sayfa listeye eklenir; filtre ya da arama değişince baştan.
      setListe((onceki) => (sayfa > 1 && onceki ? { ...r.veri, urunler: [...onceki.urunler, ...r.veri.urunler] } : r.veri));
    });
    return () => {
      iptal = true;
    };
  }, [filtre, sorgu, sayfa]);

  function filtreSec(f: string) {
    setFiltre(f);
    setSayfa(1);
  }

  function degisti(u: Urun) {
    setListe((l) => (l ? { ...l, urunler: l.urunler.map((x) => (x.id === u.id ? u : x)) } : l));
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '1rem 0 0.6rem' }}>
        {FILTRELER.map((x) => {
          const secili = filtre === x.f;
          const n = liste?.sayilar?.[x.f];
          return (
            <button
              key={x.f}
              type="button"
              aria-pressed={secili}
              onClick={() => filtreSec(x.f)}
              style={{
                padding: '0.4rem 0.8rem', borderRadius: 999, fontSize: '0.84rem', cursor: 'pointer', minHeight: 36,
                border: `1px solid ${secili ? MAVI : '#d1d5db'}`, background: secili ? '#eff6ff' : 'white',
                color: secili ? MAVI : '#374151', fontWeight: secili ? 700 : 500,
              }}
            >
              {sm[x.ad]}
              {typeof n === 'number' ? ` · ${n}` : ''}
            </button>
          );
        })}
      </div>
      <input
        type="search"
        value={arama}
        onChange={(e) => {
          setArama(e.target.value);
          setSayfa(1);
        }}
        placeholder={sm.uAra}
        aria-label={sm.uAra}
        style={{ width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '1rem', boxSizing: 'border-box' }}
      />

      {kod && (
        <p style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: 8, padding: '0.6rem 0.8rem', fontSize: '0.85rem', marginTop: 10 }}>
          {kodMetni(kod, sm)}
        </p>
      )}
      {!liste && !kod && <p style={{ color: '#6b7280' }}>{sm.yukleniyor}</p>}

      {liste && (
        <>
          <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0.6rem 0' }}>{doldur(sm.uToplam, { n: liste.toplam })}</p>
          {liste.urunler.length === 0 ? (
            <p style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '2rem', textAlign: 'center', color: '#6b7280' }}>{sm.uBos}</p>
          ) : (
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
              {liste.urunler.map((u) => (
                <UrunSatiri key={u.id} u={u} sm={sm} dil={dil} onDegisti={degisti} />
              ))}
            </div>
          )}
          {liste.sayfa < liste.sayfaSayisi && (
            <button type="button" onClick={() => setSayfa((s) => s + 1)} style={{ ...dugme(MAVI, true), marginTop: 10, width: '100%' }}>
              {sm.uDahaFazla}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function UrunSatiri({ u, sm, dil, onDegisti }: { u: Urun; sm: MagazaSiparisMetni; dil: string; onDegisti: (u: Urun) => void }) {
  const ilk = u.fiyat != null ? (dil === 'en' ? String(u.fiyat) : String(u.fiyat).replace('.', ',')) : '';
  const [fiyat, setFiyat] = useState(ilk);
  const [mesgul, setMesgul] = useState(false);
  const [mesaj, setMesaj] = useState<{ tur: 'ok' | 'hata'; metin: string } | null>(null);
  const b = bicimYap(dil === 'en' ? 'en' : 'tr', u.paraBirimi);
  const deger = sayiyaCevir(fiyat);

  async function kaydet(veri: { fiyat?: string; durum?: 'YAYINDA' | 'TASLAK' }) {
    setMesgul(true);
    setMesaj(null);
    try {
      const r = await fetch('/api/magaza/urunler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urunId: u.id, ...veri }),
      });
      const g = (await r.json().catch(() => null)) as { ok?: boolean; hata?: string; not?: string; kod?: string; urun?: Urun | null } | null;
      if (g?.urun) {
        onDegisti(g.urun);
        // Mağazanın kaydettiği değer kutuda kalsın ("1.250,50" → 1250,5): "değişti" sanılmasın.
        if (veri.fiyat !== undefined && r.ok) setFiyat(g.urun.fiyat != null ? (dil === 'en' ? String(g.urun.fiyat) : String(g.urun.fiyat).replace('.', ',')) : '');
      }
      if (r.ok && g?.ok !== false) setMesaj({ tur: 'ok', metin: g?.not ? `${sm.uKaydedildi} · ${g.not}` : sm.uKaydedildi });
      else setMesaj({ tur: 'hata', metin: g?.hata ?? kodMetni(g?.kod, sm) });
    } catch {
      setMesaj({ tur: 'hata', metin: kodMetni('ULASILAMADI', sm) });
    } finally {
      setMesgul(false);
    }
  }

  const stokMetni =
    u.stokDurumu === 'BILINMIYOR'
      ? sm.uStokBilinmiyor
      : u.stokDurumu === 'TUKENDI'
        ? sm.uTukendi
        : u.stokDurumu === 'TEDARIK'
          ? sm.uTedarik
          : u.stokDurumu === 'AZ'
            ? doldur(sm.uAzKaldi, { n: u.stok ?? 0 })
            : doldur(sm.uStok, { n: u.stok ?? 0 });
  const stokRengi = u.stokDurumu === 'STOKTA' ? '#05603a' : u.stokDurumu === 'BILINMIYOR' ? '#6b7280' : '#93370d';
  const degisik = fiyat !== ilk;

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', padding: '0.75rem 1rem', borderTop: '1px solid #f0f0f0' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0, flex: '1 1 260px' }}>
        {u.gorsel ? (
          // eslint-disable-next-line @next/next/no-img-element -- mağazanın kendi alan adındaki görsel
          <img src={u.gorsel} alt="" width={44} height={44} style={{ borderRadius: 8, objectFit: 'cover', background: '#f3f4f6', flexShrink: 0 }} />
        ) : (
          <span aria-hidden style={{ width: 44, height: 44, borderRadius: 8, background: '#f3f4f6', flexShrink: 0 }} />
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', overflowWrap: 'anywhere' }}>{u.ad}</div>
          <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>
            <span style={{ fontFamily: 'ui-monospace, monospace' }}>{u.sku}</span> ·{' '}
            <span style={{ color: stokRengi, fontWeight: 600 }}>{stokMetni}</span>
            {u.bagli && <> · {sm.uBagli}</>} ·{' '}
            <span style={{ color: u.durum === 'YAYINDA' ? '#05603a' : '#6b7280', fontWeight: 600 }}>
              {(sm as Record<string, string>)[`uDurum${u.durum}`] ?? u.durum}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.72rem', color: '#6b7280', fontWeight: 600 }}>
          {sm.uFiyat} · {u.paraBirimi}
          <input
            value={fiyat}
            onChange={(e) => setFiyat(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && degisik && !mesgul && void kaydet({ fiyat })}
            inputMode="decimal"
            style={{ width: 120, padding: '0.5rem 0.6rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '1rem', marginTop: 2 }}
          />
          {deger != null && u.paraBirimi === 'TRY' && (
            <span style={{ fontWeight: 400, marginTop: 2 }}>{doldur(sm.uKdvDahil, { t: b.para(deger * (1 + u.kdvOrani / 100)) })}</span>
          )}
        </label>
        {degisik && (
          <button type="button" disabled={mesgul} onClick={() => void kaydet({ fiyat })} style={dugme(YESIL)}>
            {mesgul ? sm.isleniyor : sm.kaydet}
          </button>
        )}
        {!degisik && u.durum !== 'ARSIV' && (
          <button
            type="button"
            disabled={mesgul}
            onClick={() => void kaydet({ durum: u.durum === 'YAYINDA' ? 'TASLAK' : 'YAYINDA' })}
            style={dugme(u.durum === 'YAYINDA' ? '#6b7280' : MAVI, true)}
          >
            {u.durum === 'YAYINDA' ? sm.uTaslagaAl : sm.uYayinaAl}
          </button>
        )}
        {u.vitrin && u.durum === 'YAYINDA' && (
          <a href={u.vitrin} target="_blank" rel="noopener noreferrer" style={{ color: MAVI, fontSize: '0.8rem' }}>
            {sm.uVitrin} ↗
          </a>
        )}
      </div>
      {mesaj && (
        <p role="status" style={{ flexBasis: '100%', margin: 0, fontSize: '0.82rem', color: mesaj.tur === 'ok' ? '#05603a' : KIRMIZI }}>
          {mesaj.metin}
        </p>
      )}
    </div>
  );
}
