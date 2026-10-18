'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { useDil } from '@/lib/i18n/client';
import type { OlusturmaSonucu } from '@/lib/whatsapp-sablon-olustur';

/**
 * "EKSİK ŞABLONLARI META'YA GÖNDER" — 7 şablonun (2 hatırlatma + 5 mağaza)
 * elle kopyalanmasının yerine tek dokunuş. Metinler bu ekranın sözlüğünde
 * değil, kendi dosyasında: ana sözlük aynı anda başka işlerde değişiyor.
 */
const METIN = {
  tr: {
    baslik: 'Şablonları Meta’ya gönder',
    alt: 'Eksik olan şablonları (hatırlatmalar + mağaza bildirimleri) tek seferde onaya yollar. Meta’da olanlara dokunmaz. Onay genelde dakikalar, bazen 1 gün sürer.',
    dugme: 'Eksik şablonları gönder',
    gonderiliyor: 'Gönderiliyor…',
    env: 'Önce Coolify’da WHATSAPP_TOKEN ve WHATSAPP_WABA_ID tanımlanmalı.',
    sinir: 'Çok sık denendi; 10 dakika sonra tekrar deneyin.',
    meta: 'Meta şablon listesini vermedi:',
    hata: 'İstek gönderilemedi.',
    olusturuldu: 'onaya gönderildi',
    zatenVar: 'zaten var',
    basarisiz: 'gönderilemedi',
  },
  en: {
    baslik: 'Send templates to Meta',
    alt: 'Submits the missing templates (reminders + store notifications) for approval in one go. Existing ones are left untouched. Approval usually takes minutes, sometimes a day.',
    dugme: 'Send missing templates',
    gonderiliyor: 'Sending…',
    env: 'WHATSAPP_TOKEN and WHATSAPP_WABA_ID must be set in Coolify first.',
    sinir: 'Tried too often; try again in 10 minutes.',
    meta: 'Meta did not return the template list:',
    hata: 'The request could not be sent.',
    olusturuldu: 'submitted for approval',
    zatenVar: 'already exists',
    basarisiz: 'failed',
  },
} satisfies Record<'tr' | 'en', Record<string, string>>;

export function SablonOlustur({ onBitti }: { onBitti?: () => void }) {
  const { dil } = useDil();
  const m = METIN[dil === 'en' ? 'en' : 'tr'];
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
    <div className="bg-white/3 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-violet-300">{m.baslik}</h3>
        <p className="text-xs text-gray-400 mt-0.5">{m.alt}</p>
      </div>
      <button
        type="button"
        onClick={gonder}
        disabled={bekliyor}
        className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
      >
        <Send className="w-4 h-4" />
        {bekliyor ? m.gonderiliyor : m.dugme}
      </button>
      {hata && <p role="alert" className="text-sm text-red-300 break-words">{hata}</p>}
      {sonuclar && (
        <ul role="status" className="space-y-1 text-sm">
          {sonuclar.map((s) => (
            <li key={s.ad} className="flex flex-wrap gap-x-2">
              <span className="font-mono text-gray-200">{s.ad}</span>
              <span className={s.sonuc === 'hata' ? 'text-red-300' : s.sonuc === 'olusturuldu' ? 'text-emerald-300' : 'text-gray-400'}>
                {s.sonuc === 'olusturuldu' ? m.olusturuldu : s.sonuc === 'zaten-var' ? `${m.zatenVar}${s.durum ? ` (${s.durum})` : ''}` : `${m.basarisiz}: ${s.hata ?? ''}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
