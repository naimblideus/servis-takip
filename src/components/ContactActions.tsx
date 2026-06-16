import { telUrl, waUrl, mapsUrl } from '@/lib/share';

// Mobil-öncelikli iletişim aksiyonları — salt <a> link (server-safe, client JS yok).
// 📞 Ara (tel:), 💬 WhatsApp (wa.me), 🗺️ Yol Tarifi (Google Maps).
export default function ContactActions({
  phone,
  address,
  whatsappText,
}: {
  phone?: string | null;
  address?: string | null;
  whatsappText?: string;
}) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.45rem 0.85rem',
    borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none',
  };
  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
      {phone && (
        <a href={telUrl(phone)} style={{ ...base, backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
          📞 Ara
        </a>
      )}
      {phone && (
        <a href={waUrl(phone, whatsappText || '')} target="_blank" rel="noreferrer" style={{ ...base, backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
          💬 WhatsApp
        </a>
      )}
      {address && address.trim() && (
        <a href={mapsUrl(address)} target="_blank" rel="noreferrer" style={{ ...base, backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }}>
          🗺️ Yol Tarifi
        </a>
      )}
    </div>
  );
}
