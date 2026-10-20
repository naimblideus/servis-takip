'use client';

/**
 * MARKA DUYURUSU — distribütörün (ör. Pantum Türkiye) bayi paneline kısa
 * duyurusu. Yalnız bayinin cihazı olan markaların süresi dolmamış en yeni 3
 * duyurusu gelir (/api/marka-duyurusu); demoda hiç istenmez. Müşteri paneli
 * bu kartı kullanmaz.
 *
 * Bayi kapatabilir: kapatılanların kimliği yalnız bu tarayıcıda tutulur
 * (localStorage). Depolama kapalıysa kart yine çalışır, yalnız kapatma
 * sayfa yenilenince unutulur.
 */
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useT } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

interface Duyuru { id: string; kurumAd: string; baslik: string; metin: string; baglanti: string | null }

const ANAHTAR = 'markaDuyurusuKapali';
const okuKapali = (): string[] => {
  try { const v = JSON.parse(localStorage.getItem(ANAHTAR) || '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; } catch { return []; }
};

export default function MarkaDuyurusuKarti() {
  const t = useT();
  const k = t.markaDuyurusu;
  const { data: session } = useSession();
  const demo = (session?.user as { demo?: boolean } | undefined)?.demo;
  const [liste, setListe] = useState<Duyuru[]>([]);
  const [kapali, setKapali] = useState<string[]>([]);

  useEffect(() => {
    if (!session?.user || demo) return;
    setKapali(okuKapali());
    fetch('/api/marka-duyurusu')
      .then((r) => (r.ok ? r.json() : null))
      .then((x) => setListe(Array.isArray(x?.duyurular) ? x.duyurular : []))
      .catch(() => {});
  }, [session?.user, demo]);

  const kapat = (id: string) => {
    const yeni = [...new Set([...kapali, id])].slice(-50);
    setKapali(yeni);
    try { localStorage.setItem(ANAHTAR, JSON.stringify(yeni)); } catch { /* depolama kapalı */ }
  };

  const gorunen = liste.filter((d) => !kapali.includes(d.id));
  if (!gorunen.length) return null;
  return (
    <div className="space-y-2">
      {gorunen.map((d) => (
        <section key={d.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 rounded-2xl border border-indigo-200 bg-indigo-50/70 px-4 py-3">
          <div className="min-w-0 flex-1 basis-60">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">{doldur(k.ust, { kurum: d.kurumAd })}</p>
            <b className="block break-words text-gray-900">{d.baslik}</b>
            <p className="mt-0.5 whitespace-pre-line break-words text-sm text-gray-700">{d.metin}</p>
          </div>
          <div className="flex items-center gap-2">
            {d.baglanti && d.baglanti.startsWith('https://') && (
              <a href={d.baglanti} target="_blank" rel="noopener noreferrer nofollow"
                className="inline-flex min-h-11 items-center rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-700">
                {k.ayrinti}
              </a>
            )}
            <button type="button" onClick={() => kapat(d.id)}
              className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-gray-600 hover:bg-indigo-100">
              {k.kapat}
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}
