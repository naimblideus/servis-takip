'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

interface Musteri {
  id: string;
  ad: string;
  telefon: string;
  acik: boolean;
  jeton: string | null;
  cihaz: number;
  sonGirdi: string | null;
}

/**
 * MÜŞTERİ PANELİ — toplu açma ve bağlantı gönderme.
 *
 * ── NEDEN BU EKRAN VAR ────────────────────────────────────────────────
 * Portal erişimi müşteri müşteri açılıyordu ve ölçüldü: 305 müşterinin
 * HİÇBİRİNDE erişim yok. 305 kartı tek tek açmak kimsenin yapmayacağı bir
 * iş, o yüzden hiç yapılmamış — ve ürünün rakipsiz olduğu her şey
 * (Cihazlarım, toner tahmini, sahada doğrulanmış uyumluluk) karanlıkta
 * kalmış.
 *
 * Burada iki iş var ve ikisi de tek ekranda olmalı: erişimi AÇMAK ve
 * bağlantıyı GÖNDERMEK. Açıp göndermemek hiçbir şey değiştirmiyor.
 */
export default function MusteriPortaliSayfasi() {
  const [musteriler, setMusteriler] = useState<Musteri[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [calisiyor, setCalisiyor] = useState(false);
  const [mesaj, setMesaj] = useState('');
  const [hata, setHata] = useState('');
  const [ara, setAra] = useState('');
  const [filtre, setFiltre] = useState<'hepsi' | 'kapali' | 'acik'>('kapali');

  async function yukle() {
    setYukleniyor(true);
    try {
      const r = await fetch('/api/customers/portal-liste');
      const j = await r.json();
      if (r.ok) setMusteriler(j.musteriler);
      else setHata(j.error ?? 'Liste alınamadı');
    } catch {
      setHata('Bağlantı hatası');
    } finally {
      setYukleniyor(false);
    }
  }

  useEffect(() => {
    yukle();
  }, []);

  const sayim = useMemo(
    () => ({
      hepsi: musteriler.length,
      acik: musteriler.filter((m) => m.acik).length,
      kapali: musteriler.filter((m) => !m.acik).length,
      /* Telefonu olmayanda portal açmak, bağlantı gönderilemeyecek bir
         müşterinin verisini yayınlamak demek: fayda yok, yüzey var. */
      acilabilir: musteriler.filter((m) => !m.acik && m.telefon.trim()).length,
    }),
    [musteriler]
  );

  const gosterilen = useMemo(() => {
    const q = ara.trim().toLowerCase();
    return musteriler.filter((m) => {
      if (filtre === 'acik' && !m.acik) return false;
      if (filtre === 'kapali' && m.acik) return false;
      if (!q) return true;
      return m.ad.toLowerCase().includes(q) || m.telefon.includes(q);
    });
  }, [musteriler, ara, filtre]);

  async function topluAc() {
    setCalisiyor(true);
    setMesaj('');
    setHata('');
    try {
      const r = await fetch('/api/customers/portal-toplu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const j = await r.json();
      if (r.ok) {
        setMesaj(`${j.acilan} müşteriye panel erişimi açıldı. Sırada bağlantıları göndermek var.`);
        await yukle();
      } else {
        setHata(j.error ?? 'Açılamadı');
      }
    } catch {
      setHata('Bağlantı hatası');
    } finally {
      setCalisiyor(false);
    }
  }

  /** Müşterinin kendi paneline giden tam adres. */
  const bagAdresi = (jeton: string) =>
    typeof window === 'undefined' ? `/m/${jeton}` : `${window.location.origin}/m/${jeton}`;

  /**
   * WhatsApp mesajı HAZIR geliyor.
   *
   * Boş bir sohbet açmak, bayiyi her müşteri için metin yazmaya zorlar ve
   * 300 müşteride bu iş yapılmaz. Mesaj ne olduğunu da anlatıyor: bağlantıyı
   * alan kişi "bu ne" diye sormasın.
   */
  const waBaglantisi = (m: Musteri) => {
    const tel = m.telefon.replace(/\D/g, '');
    const ulus = tel.length === 11 && tel.startsWith('0') ? '90' + tel.slice(1) : tel;
    const metin =
      `Merhaba, cihazlarınızı ve sarf takibinizi görebileceğiniz kişisel panelinizi açtık.\n` +
      `Şifre gerekmez, bu bağlantı size özeldir:\n${bagAdresi(m.jeton!)}`;
    return `https://wa.me/${ulus}?text=${encodeURIComponent(metin)}`;
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Müşteri Paneli</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Müşteriniz şifresiz bir bağlantıyla kendi cihazlarını, sayaçlarını ve
            onlara uyan sarf malzemesini görür. Mağazanız varsa aynı bağlantıdan
            sipariş de verebilir.
          </p>
        </div>
        <Link href="/customers" className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
          Müşteriler
        </Link>
      </div>

      {/* DURUM ÖNCE: kaçının erişimi var, kaçının yok. Bu sayı görülmeden
          "toplu aç" düğmesi anlamsız bir düğme. */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { ad: 'Erişimi olan', n: sayim.acik },
          { ad: 'Erişimi olmayan', n: sayim.kapali },
          { ad: 'Şimdi açılabilir', n: sayim.acilabilir, alt: 'telefonu kayıtlı olanlar' },
        ].map((k) => (
          <div key={k.ad} className="rounded-lg border bg-white p-4">
            <div className="text-2xl font-bold tabular-nums">{k.n}</div>
            <div className="text-sm text-gray-600">{k.ad}</div>
            {k.alt && <div className="mt-0.5 text-xs text-gray-400">{k.alt}</div>}
          </div>
        ))}
      </div>

      {sayim.acilabilir > 0 && (
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-900">
            <b>{sayim.acilabilir} müşterinin</b> panel erişimi kapalı. Toplu açmak
            mevcut bağlantıları bozmaz — yalnız kapalı olanları açar.
          </p>
          <button
            type="button"
            onClick={topluAc}
            disabled={calisiyor}
            className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {calisiyor ? 'Açılıyor…' : `${sayim.acilabilir} müşteriye erişim aç`}
          </button>
        </div>
      )}

      {mesaj && <p className="mt-4 rounded bg-green-50 p-3 text-sm text-green-800">{mesaj}</p>}
      {hata && <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{hata}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {(
          [
            ['kapali', 'Erişimi olmayan'],
            ['acik', 'Erişimi olan'],
            ['hepsi', 'Hepsi'],
          ] as const
        ).map(([d, a]) => (
          <button
            key={d}
            type="button"
            onClick={() => setFiltre(d)}
            className={`rounded border px-3 py-1.5 text-sm ${
              filtre === d ? 'border-gray-900 bg-gray-900 text-white' : 'bg-white hover:bg-gray-50'
            }`}
          >
            {a}
          </button>
        ))}
        <input
          value={ara}
          onChange={(e) => setAra(e.target.value)}
          placeholder="Ad veya telefon ara"
          className="ml-auto w-56 rounded border px-3 py-1.5 text-sm"
        />
      </div>

      {yukleniyor ? (
        <p className="mt-6 text-sm text-gray-500">Yükleniyor…</p>
      ) : gosterilen.length === 0 ? (
        <p className="mt-6 rounded-lg border bg-white p-10 text-center text-sm text-gray-500">
          Bu filtrede müşteri yok.
        </p>
      ) : (
        <ul className="mt-4 divide-y rounded-lg border bg-white">
          {gosterilen.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{m.ad}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-gray-500">
                  <span className="tabular-nums">{m.telefon.trim() || 'telefon yok'}</span>
                  {/* Cihazı olmayan müşteride panel BOŞ görünür. Bağlantıyı
                      göndermeden önce bilinmesi gereken tek şey bu. */}
                  <span className={m.cihaz === 0 ? 'text-amber-700' : ''}>
                    {m.cihaz === 0 ? 'cihaz kaydı yok' : `${m.cihaz} cihaz`}
                  </span>
                  {m.sonGirdi && (
                    <span className="text-green-700">
                      girdi · {new Date(m.sonGirdi).toLocaleDateString('tr-TR')}
                    </span>
                  )}
                </div>
              </div>

              {m.acik && m.jeton ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(bagAdresi(m.jeton!))}
                    className="rounded border px-2.5 py-1.5 text-xs hover:bg-gray-50"
                  >
                    Bağlantıyı kopyala
                  </button>
                  {m.telefon.trim() && (
                    <a
                      href={waBaglantisi(m)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded bg-gray-900 px-2.5 py-1.5 text-xs text-white hover:bg-gray-700"
                    >
                      WhatsApp&apos;tan gönder
                    </a>
                  )}
                </div>
              ) : (
                <span className="text-xs text-gray-400">
                  {m.telefon.trim() ? 'erişim kapalı' : 'telefon yok — açılamaz'}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
