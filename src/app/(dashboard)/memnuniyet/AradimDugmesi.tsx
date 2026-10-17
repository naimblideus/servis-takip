'use client';

/**
 * "Aradım" — 0–6 veren müşteri arandı; satır "Aranması gerekenler"den düşer.
 * Demoda uç kapalı (lib/demo-yazma.ts) ve cevabı olduğu gibi gösterilir:
 * ziyaretçi neden çalışmadığını okusun, düğme "bozuk" görünmesin.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n/client';

export default function AradimDugmesi({ anketId }: { anketId: string }) {
  const t = useT();
  const router = useRouter();
  const [durum, setDurum] = useState<'BOS' | 'YUKLENIYOR' | 'TAMAM'>('BOS');
  const [hata, setHata] = useState<string | null>(null);

  const bas = async () => {
    setDurum('YUKLENIYOR');
    setHata(null);
    try {
      const r = await fetch(`/api/memnuniyet/${encodeURIComponent(anketId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arandi: true }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) { setHata(d?.error || t.genel.hata); setDurum('BOS'); return; }
      setDurum('TAMAM');
      router.refresh();
    } catch {
      setHata(t.genel.baglantiHatasi);
      setDurum('BOS');
    }
  };

  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <button
        type="button"
        onClick={bas}
        disabled={durum !== 'BOS'}
        className="btn-primary"
        style={{ minHeight: 44, ...(durum === 'TAMAM' ? { background: '#0B8259', color: '#FFFFFF' } : {}) }}
      >
        {durum === 'TAMAM' ? t.memnuniyet.arandi : durum === 'YUKLENIYOR' ? t.genel.kaydediliyor : t.memnuniyet.aradim}
      </button>
      {hata && <span role="alert" style={{ color: '#B93333', fontSize: '0.78rem', maxWidth: 260 }}>{hata}</span>}
    </div>
  );
}
