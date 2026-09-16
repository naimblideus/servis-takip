'use client';

import { telUrl, waUrl, mapsUrl } from '@/lib/share';
import { useT } from '@/lib/i18n/client';

// Mobil-öncelikli iletişim aksiyonları: 📞 Ara (tel:), 💬 WhatsApp (wa.me),
// 🗺️ Yol Tarifi (Google Maps). Üç <a> etiketinden ibaret.
//
// Eskiden sunucu bileşeniydi ("client JS yok"); etiketleri kullanıcının
// diline çevirmek için istemciye alındı — dil bağlamı React bağlamında
// duruyor ve sunucu bileşeni onu okuyamıyor. Bedeli üç bağlantılık bir
// paket; karşılığı beş ekranda birden doğru dil.
export default function ContactActions({
  phone,
  address,
  whatsappText,
}: {
  phone?: string | null;
  address?: string | null;
  whatsappText?: string;
}) {
  const t = useT();
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.45rem 0.85rem',
    borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none',
  };
  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
      {phone && (
        <a href={telUrl(phone)} style={{ ...base, backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
          {t.fisDetay.ara}
        </a>
      )}
      {phone && (
        <a href={waUrl(phone, whatsappText || '')} target="_blank" rel="noreferrer" style={{ ...base, backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
          {t.fisDetay.whatsapp}
        </a>
      )}
      {address && address.trim() && (
        <a href={mapsUrl(address)} target="_blank" rel="noreferrer" style={{ ...base, backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }}>
          {t.fisDetay.yolTarifi}
        </a>
      )}
    </div>
  );
}
