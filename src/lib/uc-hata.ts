/**
 * UÇ NOKTA HATALARI — tek yerde, okuyanın dilinde.
 *
 * ── SORUN ────────────────────────────────────────────────────────────────
 * API uçları hata cümlesini Türkçe olarak kendi içinde kuruyordu
 * ("Müşteri bulunamadı"). Ekran onu olduğu gibi basıyordu; yani arayüzün
 * tamamı İngilizce olsa bile ilk hatada Türkçe bir cümle çıkıyordu.
 * Bir bayi için en kötü an, işler ters gittiği andır — anlamadığı bir dilde
 * hata okumak o anı iki kat kötü yapar.
 *
 * ── NEDEN BURADA CÜMLE KURULUYOR ─────────────────────────────────────────
 * Genel kuralımız "sunucu cümle kurmaz, kod döner"dir. Sebebi sunucunun
 * okuyanın dilini bilmemesidir. Hata yanıtında bu sebep YOKTUR: yanıtın tek
 * bir okuyucusu var, o da isteği yapan kişi ve dili istekle birlikte geliyor.
 * Bu yüzden cümle burada, isteğin dilinde kuruluyor ve `error` alanı eskisi
 * gibi hazır metin taşıyor — ekranlarda tek satır değişiklik gerekmedi.
 *
 * `kod` alanı da dönüyor: ekran bir hataya özel davranmak isterse (ör. stok
 * yetersizse başka bir kutu açmak) metne değil koda bakar.
 *
 * ── MÜŞTERİYE AÇIK UÇLAR ─────────────────────────────────────────────────
 * Portal ve QR arıza bildirimi gibi uçlarda okuyan MÜŞTERİDİR ve onun dil
 * çerezi yoktur. Oralarda `dil` geçilir: bayinin dili neyse o.
 */
import { NextResponse } from 'next/server';
import { sunucuDili } from './i18n/sunucu';
import { sozluk, doldur, type Dil, type Sozluk } from './i18n/sozluk';

export type UcHataKodu = keyof Sozluk['ucHata'];

/**
 * Hata yanıtı üretir.
 *
 * @param kod     sözlükteki hata anahtarı
 * @param durum   HTTP durum kodu (varsayılan 400)
 * @param secenek deger: {p1}, {p2}… yer tutucuları · dil: okuyanın dili
 *                (müşteriye açık uçlarda bayinin dili geçilir) ·
 *                ek: yanıta eklenecek alanlar (ör. aktarım raporundaki
 *                bulunan başlıklar) — `kod` ve `error` ezilemez.
 */
export async function ucHatasi(
  kod: UcHataKodu,
  durum = 400,
  secenek?: {
    deger?: Record<string, string | number>;
    dil?: Dil;
    ek?: Record<string, unknown>;
  },
): Promise<NextResponse> {
  const dil = secenek?.dil ?? (await sunucuDili());
  const kalip = sozluk(dil).ucHata[kod];
  const error = secenek?.deger ? doldur(kalip, secenek.deger) : kalip;
  // Sıra önemli: `kod` varsayılan olarak sözlük anahtarıdır, ama uç kendi
  // istemci kodunu `ek` içinde verirse O geçerli olur (aktarım ekranları
  // yıllardır kendi kısa kodlarına bakıyor). `error` ezilemez — çeviri bizde.
  return NextResponse.json({ kod, ...(secenek?.ek ?? {}), error }, { status: durum });
}
