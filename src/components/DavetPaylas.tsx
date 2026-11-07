'use client';

import { useState } from 'react';
import { useT } from '@/lib/i18n/client';
import { waAdresi } from '@/lib/kurulum';

/**
 * DAVET BAĞLANTISINI PAYLAŞ — WhatsApp'ta aç + kopyala.
 *
 * Bağlantı jetonu saklanmadığı için yalnız bu ekranda, bir kez görünür.
 * Telefon biliniyorsa (süper admin yeni bayi formu) WhatsApp doğrudan o kişiyle
 * açılır; bilinmiyorsa WhatsApp kişi seçtirir. Mesaj otomatik GİTMEZ: yönetici
 * kendi WhatsApp'ından gönderir (platform numarasından toplu mesaj yok).
 */
export default function DavetPaylas({ baglanti, mesaj, telefon, baslik, aciklama }: {
  baglanti: string;
  mesaj: string;
  telefon?: string | null;
  baslik: string;
  aciklama: string;
}) {
  const t = useT();
  const [kopyalandi, setKopyalandi] = useState(false);
  const wa = waAdresi(telefon, mesaj) ?? `https://wa.me/?text=${encodeURIComponent(mesaj)}`;

  const kopyala = async () => {
    try {
      await navigator.clipboard.writeText(baglanti);
      setKopyalandi(true);
      setTimeout(() => setKopyalandi(false), 2500);
    } catch {
      /* pano izni yok: bağlantı aşağıda seçilebilir duruyor */
    }
  };

  return (
    <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-left text-sm text-emerald-900">
      <p className="font-bold">{baslik}</p>
      <p className="mt-1">{aciklama}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={wa} target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center rounded-xl bg-emerald-600 px-4 font-semibold text-white hover:bg-emerald-500">
          {t.kullanici.davetWhatsapp}
        </a>
        <button type="button" onClick={kopyala}
          className="inline-flex min-h-11 items-center rounded-xl border border-emerald-300 bg-white px-4 font-semibold text-emerald-800 hover:bg-emerald-100">
          {kopyalandi ? t.kullanici.davetKopyalandi : t.kullanici.davetKopyala}
        </button>
      </div>
      <p className="mt-3 break-all rounded-lg bg-white/70 p-2 font-mono text-xs text-emerald-950 select-all">{baglanti}</p>
    </div>
  );
}
