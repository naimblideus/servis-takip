'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { useDil } from '@/lib/i18n/client';
import type { OlusturmaSonucu } from '@/lib/whatsapp-sablon-olustur';
import { sablonOlusturMetni } from '@/lib/whatsapp-sablon-metin';

/**
 * "EKSİK ŞABLONLARI META'YA GÖNDER" — 7 şablonun (2 hatırlatma + 5 mağaza)
 * elle kopyalanmasının yerine tek dokunuş. Metinler kendi dosyasında
 * (lib/whatsapp-sablon-metin): ekranda gömülü Türkçe kalmasın.
 */
export function SablonOlustur({ onBitti }: { onBitti?: () => void }) {
  const { dil } = useDil();
  const m = sablonOlusturMetni(dil);
  const [bekliyor, setBekliyor] = useState(false);
  const [hata, setHata] = useState('');
  const [sonuclar, setSonuclar] = useState<OlusturmaSonucu[] | null>(null);

  async function gonder() {
    setBekliyor(true);
    setHata('');
    try {
      const r = await fetch('/api/super-admin/whatsapp/sablon', { method: 'POST' });
      const j = await r.json().catch(() => null);
      if (!j?.ok) {
        setHata(j?.kod === 'env' ? m.env : j?.kod === 'sinir' ? m.sinir : j?.kod === 'meta' ? `${m.meta} ${j.ayrinti ?? ''}` : m.hata);
        return;
      }
      setSonuclar(j.sonuclar);
      onBitti?.();
    } catch {
      setHata(m.hata);
    } finally {
      setBekliyor(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-blue-700">{m.baslik}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{m.alt}</p>
      </div>
      <button
        type="button"
        onClick={gonder}
        disabled={bekliyor}
        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
      >
        <Send className="w-4 h-4" />
        {bekliyor ? m.gonderiliyor : m.dugme}
      </button>
      {hata && <p role="alert" className="text-sm text-red-700 break-words">{hata}</p>}
      {sonuclar && (
        <ul role="status" className="space-y-1 text-sm">
          {sonuclar.map((s) => (
            <li key={s.ad} className="flex flex-wrap gap-x-2">
              <span className="font-mono text-gray-800">{s.ad}</span>
              <span className={s.sonuc === 'hata' ? 'text-red-700' : s.sonuc === 'olusturuldu' ? 'text-emerald-700' : 'text-gray-500'}>
                {s.sonuc === 'olusturuldu' ? m.olusturuldu : s.sonuc === 'zaten-var' ? `${m.zatenVar}${s.durum ? ` (${s.durum})` : ''}` : `${m.basarisiz}: ${s.hata ?? ''}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
