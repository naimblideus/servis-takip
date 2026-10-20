'use client';

/**
 * ÖRNEK VERİ ŞERİDİ — ekip test hesabında her sayfanın üstünde.
 *
 * Ekip test hesapları (Tenant.ekipTest) herkese açık demoyla aynı örnek
 * veriyle kurulur ve her özelliği açıktır. Ekran gerçek bir bayi gibi
 * göründüğü için ekipteki biri bir ekran görüntüsünü gerçek müşteri verisi
 * sanabilir ya da bir rakamı satışta kullanabilir. Şerit bunu her sayfada
 * söyler; kapatılamaz.
 */
import { useT } from '@/lib/i18n/client';

export default function OrnekVeriSeridi() {
  const t = useT();
  return (
    <div className="print:hidden" role="note"
      style={{
        display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap',
        padding: '0.55rem 1rem', fontSize: '0.85rem', lineHeight: 1.45,
        background: '#eef2ff', borderBottom: '1px solid #c7d2fe', color: '#312e81',
      }}>
      <span style={{ fontWeight: 700 }}>{t.ornekVeri.etiket}</span>
      <span>{t.ornekVeri.metin}</span>
    </div>
  );
}
