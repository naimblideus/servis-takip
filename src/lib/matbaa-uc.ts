// MATBAA UÇLARI — ortak hata yanıtı. Servisler (baski-is-kayit) kod döner;
// burada okuyanın dilinde cümleye çevrilir (lib/uc-hata, BASKI_ önekli).
import { AuthError, authErrorResponse } from '@/lib/api-auth';
import { ucHatasi, type UcHataKodu } from '@/lib/uc-hata';

const DURUM: Record<string, number> = {
  IS_YOK: 404, URUN_YOK: 404, MUSTERI_YOK: 404, DEGISTI: 409, YETKI_YOK: 403, MATBAA_DEGIL: 403,
};

/** Servis hata kodu → yanıt (ör. ODEME_EKSIK → BASKI_ODEME_EKSIK, 400). */
export function baskiHatasi(kod: string) {
  return ucHatasi(`BASKI_${kod}` as UcHataKodu, DURUM[kod] ?? 400);
}

/** Rota catch'i: matbaa kapısının kodlu hatası çevrilir, gerisi standart yanıt. */
export function matbaaYaniti(e: unknown) {
  if (e instanceof AuthError && e.message.startsWith('BASKI_')) return ucHatasi(e.message as UcHataKodu, e.status);
  return authErrorResponse(e);
}
