// WhatsApp / paylaşım yardımcıları (mobil-öncelikli; ana yapıyı bozmaz, ek aksiyon).
import { sozluk, doldur, dilMi, VARSAYILAN_DIL, type Dil } from '@/lib/i18n/sozluk';
import { bicimYap } from '@/lib/bicim';

/** Türk telefonunu wa.me formatına çevir: 0532... -> 90532...; +90/90 korunur; rakam-dışı atılır. */
/**
 * WhatsApp'a gönderilebilir TÜRK CEP numarası; değilse boş dize.
 *
 * ── NEDEN DOĞRULAMA ŞART ──────────────────────────────────────────────
 * Önceki hâl her girdiyi bir numaraya çeviriyordu: "BOS-000070" → rakamlar
 * "000070" → başında 0 var → "9000070". Ortaya wa.me/9000070 gibi ÇALIŞMAYAN
 * bir bağlantı çıkıyordu.
 *
 * Ölçüldü (Saygılı, üretim): 305 müşterinin 124'ünde telefon "BOS-…" yer
 * tutucusu. Yani Müşteri Paneli ekranındaki "WhatsApp'tan gönder"
 * düğmelerinin 124'ü kırık bağlantı açıyordu — ve bunu ancak müşteri
 * "bana bir şey gelmedi" dediğinde öğrenirdiniz.
 *
 * ── NEDEN YALNIZ CEP ──────────────────────────────────────────────────
 * WhatsApp sabit hatta çalışmaz. Sabit hat için bağlantı üretmek de
 * "bu numara WhatsApp'ta kayıtlı değil" ekranı demek — hiç göstermemekten
 * kötü. Ölçüt Türkiye cep biçimi: 90 + 5XXXXXXXXX.
 *
 * ── BOŞ DÖNMEK GÜVENLİ ────────────────────────────────────────────────
 * `waUrl` boş numarada `https://wa.me/?text=…` üretiyor: WhatsApp kişi
 * seçtirme ekranıyla açılıyor ve metin hazır geliyor. Yani kırık numara
 * yerine "kime göndereceğini sen seç" — bozuk değil, eksik.
 *
 * NOT: ICP Türkiye. Yurt dışı numara gerekirse ölçüt burada genişletilir.
 */
export function waPhone(raw: string | null | undefined): string {
  const d = (raw || '').replace(/\D/g, '');
  if (!d) return '';
  const n = d.startsWith('90') ? d
    : d.startsWith('0') ? '90' + d.slice(1)
    : d.length === 10 ? '90' + d // 5XXXXXXXXX
    : '';
  return /^905\d{9}$/.test(n) ? n : '';
}

/** WhatsApp bağlantısı üretilebilir mi? Düğmeyi çizmeden önce sorulur. */
export function waGecerliMi(raw: string | null | undefined): boolean {
  return waPhone(raw) !== '';
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

/**
 * ── MÜŞTERİYE GİDEN METİN BAYİNİN DİLİNDE ────────────────────────────────
 * Aşağıdaki üreticiler `dil`/`birim` alır. Vermeyen eski çağrı Türkçe/₺ ile
 * çalışmaya devam eder; yeni çağrılar bayinin dilini geçer.
 */
interface MesajDili { dil?: Dil; birim?: string | null }

const mesajSozlugu = (p: MesajDili) => sozluk(p.dil).musteriMesaji;
const mesajBicim = (p: MesajDili) => bicimYap(dilMi(p.dil) ? p.dil : VARSAYILAN_DIL, p.birim);
const selam = (p: MesajDili & { customerName?: string }) => {
  const m = mesajSozlugu(p);
  return p.customerName ? doldur(m.sayin, { ad: p.customerName }) : m.merhaba;
};

/** Vadesi geçmiş bakiye hatırlatma mesajı (müşteriye). */
export function reminderMessage(p: MesajDili & { tenantName?: string; customerName?: string; debt: number }): string {
  const m = mesajSozlugu(p);
  const lines = [selam(p), doldur(m.borcHatirlatma, { n: mesajBicim(p).para(p.debt) })];
  if (p.tenantName) lines.push('', p.tenantName);
  return lines.join('\n');
}

/** Bu durumda müşteriye bildirim anlamlı mı? (NEW/CANCELLED için değil) */
export const NOTIFY_STATUSES = ['IN_SERVICE', 'WAITING_FOR_PART', 'READY', 'DELIVERED'];

/**
 * Servis durumu değişince müşteriye WhatsApp bildirimi.
 * İş bitmişse (READY/DELIVERED) yapılan işlem ve tutar da eklenir — müşteri
 * "ne yapıldı, ne ödeyeceğim" diye aramak zorunda kalmasın.
 */
export function statusMessage(status: string, p: MesajDili & {
  tenantName?: string; customerName?: string; deviceName?: string; ticketNumber?: string;
  actionText?: string; totalCost?: number;
}): string {
  const m = mesajSozlugu(p);
  const b = mesajBicim(p);
  // Cihaz adı SONU BOŞLUKLU giriyor ya da hiç girmiyor; cümledeki yerini
  // sözlük belirliyor (İngilizcede "your <marka> device", Türkçede
  // "<marka> cihazınız").
  const dev = p.deviceName ? `${p.deviceName} ` : '';
  const kalip = (m.durum as Record<string, string>)[status] ?? m.durum.DIGER;
  const body = doldur(kalip, { cihaz: dev });
  const lines = [selam(p), body + (p.ticketNumber ? doldur(m.fisNo, { n: p.ticketNumber }) : '')];

  // İş bittiyse detay ekle — boş alan varsa satırı hiç koyma (yarım mesaj gitmesin)
  if (status === 'READY' || status === 'DELIVERED') {
    const action = (p.actionText || '').trim();
    if (action) lines.push('', doldur(m.yapilanIslem, { n: action }));
    if (Number(p.totalCost) > 0) lines.push(`${action ? '' : '\n'}${doldur(m.tutar, { n: b.para(Number(p.totalCost)) })}`);
  }

  if (p.tenantName) lines.push('', p.tenantName);
  return lines.join('\n');
}

/** Fatura WhatsApp mesajı (müşteriye). */
export function invoiceMessage(p: MesajDili & {
  tenantName?: string; customerName?: string; invoiceNumber: string; period?: string;
  totalAmount: number; openAmount: number; dueDate: string | Date;
}): string {
  const m = mesajSozlugu(p);
  const b = mesajBicim(p);
  const lines = [
    selam(p),
    doldur(m.faturaBaslik, {
      no: p.invoiceNumber,
      donem: p.period ? doldur(m.faturaDonem, { n: p.period }) : '',
    }),
    doldur(m.faturaTutar, { n: b.para(p.totalAmount) }),
  ];
  if (p.openAmount > 0) lines.push(doldur(m.faturaKalan, { kalan: b.para(p.openAmount), vade: b.tarih(p.dueDate) }));
  else lines.push(m.faturaOdendi);
  if (p.tenantName) lines.push('', p.tenantName);
  return lines.join('\n');
}

/** Tahsilat makbuzu WhatsApp mesajı (müşteriye). */
export function paymentMessage(p: MesajDili & { tenantName?: string; customerName?: string; amount: number; date?: string | Date }): string {
  const m = mesajSozlugu(p);
  const b = mesajBicim(p);
  const lines = [
    selam(p),
    doldur(m.odemeAlindi, {
      tutar: b.para(p.amount),
      tarih: p.date ? doldur(m.odemeTarih, { n: b.tarih(p.date) }) : '',
    }),
  ];
  if (p.tenantName) lines.push('', p.tenantName);
  return lines.join('\n');
}
