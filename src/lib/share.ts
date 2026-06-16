// WhatsApp / paylaşım yardımcıları (mobil-öncelikli; ana yapıyı bozmaz, ek aksiyon).

/** Türk telefonunu wa.me formatına çevir: 0532... -> 90532...; +90/90 korunur; rakam-dışı atılır. */
export function waPhone(raw: string | null | undefined): string {
  let d = (raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('90')) return d;
  if (d.startsWith('0')) return '90' + d.slice(1);
  if (d.length === 10) return '90' + d; // 5XXXXXXXXX
  return d;
}

/** wa.me linki: numara varsa o kişiye, yoksa kişi seçtirir. metin ön-doldurulur. */
export function waUrl(phone: string | null | undefined, text: string): string {
  const p = waPhone(phone);
  const base = p ? `https://wa.me/${p}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(text)}`;
}

/** WhatsApp'ı yeni sekmede aç (mobil + masaüstü). */
export function openWhatsApp(phone: string | null | undefined, text: string): void {
  if (typeof window !== 'undefined') window.open(waUrl(phone, text), '_blank');
}

/** Tıkla-ara linki: tel:+90... */
export function telUrl(phone: string | null | undefined): string {
  const p = waPhone(phone);
  return p ? `tel:+${p}` : 'tel:';
}

/** Adrese DİREKT yol tarifi aç (bulunduğun konumdan navigasyon). */
export function mapsUrl(address: string | null | undefined): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent((address || '').trim())}`;
}

/** Vadesi geçmiş bakiye hatırlatma mesajı (müşteriye). */
export function reminderMessage(p: { tenantName?: string; customerName?: string; debt: number }): string {
  const lines = [
    p.customerName ? `Sayın ${p.customerName},` : 'Merhaba,',
    `${fmtTL(p.debt)} tutarında vadesi geçmiş bakiyeniz görünmektedir. Ödemeniz için teşekkür ederiz.`,
  ];
  if (p.tenantName) lines.push('', p.tenantName);
  return lines.join('\n');
}

/** Servis durumu değişince müşteriye WhatsApp bildirimi. */
export function statusMessage(status: string, p: { tenantName?: string; customerName?: string; deviceName?: string; ticketNumber?: string }): string {
  const head = p.customerName ? `Sayın ${p.customerName},` : 'Merhaba,';
  const dev = p.deviceName ? `${p.deviceName} ` : '';
  let body: string;
  switch (status) {
    case 'IN_SERVICE': body = `${dev}cihazınız servise alınmıştır, en kısa sürede ilgilenilecektir.`; break;
    case 'WAITING_FOR_PART': body = `${dev}cihazınız için parça temin ediliyor; süreç biraz uzayabilir, bilginize.`; break;
    case 'READY': body = `${dev}cihazınız hazır, teslim alabilirsiniz.`; break;
    case 'DELIVERED': body = `${dev}cihazınız teslim edilmiştir. Teşekkür ederiz.`; break;
    default: body = `${dev}cihazınızın servis durumu güncellendi.`;
  }
  const lines = [head, body + (p.ticketNumber ? ` (Fiş: ${p.ticketNumber})` : '')];
  if (p.tenantName) lines.push('', p.tenantName);
  return lines.join('\n');
}

/** "Cihazınız hazır" WhatsApp mesajı (müşteriye). */
export function readyMessage(p: { tenantName?: string; customerName?: string; deviceName?: string; ticketNumber?: string }): string {
  const lines = [
    p.customerName ? `Sayın ${p.customerName},` : 'Merhaba,',
    `${p.deviceName ? p.deviceName + ' ' : ''}cihazınız hazır, teslim alabilirsiniz.${p.ticketNumber ? ` (Fiş: ${p.ticketNumber})` : ''}`,
  ];
  if (p.tenantName) lines.push('', p.tenantName);
  return lines.join('\n');
}

const fmtTL = (n: number) => '₺' + Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtD = (s: string | Date) => new Date(s).toLocaleDateString('tr-TR');

/** Fatura WhatsApp mesajı (müşteriye). */
export function invoiceMessage(p: {
  tenantName?: string; customerName?: string; invoiceNumber: string; period?: string;
  totalAmount: number; openAmount: number; dueDate: string | Date;
}): string {
  const lines = [
    p.customerName ? `Sayın ${p.customerName},` : 'Merhaba,',
    `${p.invoiceNumber} numaralı faturanız${p.period ? ` (${p.period})` : ''}:`,
    `Tutar: ${fmtTL(p.totalAmount)}`,
  ];
  if (p.openAmount > 0) lines.push(`Kalan: ${fmtTL(p.openAmount)} — Son ödeme: ${fmtD(p.dueDate)}`);
  else lines.push('Ödenmiştir, teşekkür ederiz.');
  if (p.tenantName) lines.push('', p.tenantName);
  return lines.join('\n');
}

/** Tahsilat makbuzu WhatsApp mesajı (müşteriye). */
export function paymentMessage(p: { tenantName?: string; customerName?: string; amount: number; date?: string | Date }): string {
  const lines = [
    p.customerName ? `Sayın ${p.customerName},` : 'Merhaba,',
    `${fmtTL(p.amount)} tutarındaki ödemeniz${p.date ? ` (${fmtD(p.date)})` : ''} alınmıştır. Teşekkür ederiz.`,
  ];
  if (p.tenantName) lines.push('', p.tenantName);
  return lines.join('\n');
}
