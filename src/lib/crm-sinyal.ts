// servis-takip → Nexus CRM sinyali: NE gönderilir (saf, test edilebilir). Gönderim /api/cron/crm-sinyal'de.
//
// CRM (crm.nextusservis.com/api/olay) her sinyali fırsata işler: satış ısınmayı ve takibi görür,
// kurulum ilerlemesi CRM'in Müşteri Akışı ekranında görünür, ürün içinden bildirilen sorun CRM'in
// Merkez'ine geri bildirim olarak düşer (ürün geliştirmenin girdisi: geri bildirim → görev → sprint).
// Mükerrerliği CRM eler (anahtar), burada "gönderdim mi" durumu tutulmaz.

export type SinyalTuru =
  | 'DENEME_BASLADI'
  | 'ILK_KAYIT'
  | 'FATURA_KESILDI'
  | 'LIMIT_DOLDU'
  | 'GIRIS_YOK'
  | 'KURULUM_ILERLEDI'
  | 'KURULUM_TAMAM'
  | 'SORUN_BILDIRDI';

export type Sinyal = {
  tur: SinyalTuru;
  baslik: string;
  detay?: string;
  anahtar: string; // mükerrer koruma — CRM aynı anahtarı ikinci kez işlemez
  geriBildirim?: { tur: 'SORUN' | 'ISTEK' | 'SORU'; metin: string; kimden: string | null; kaynakRef: string };
};

/** Kurulum adımlarının CRM'de okunacak adı (src/lib/kurulum.ts AdimKodu). */
export const ADIM_ADI: Record<string, string> = {
  FIRMA: 'firma bilgisi',
  CIHAZ: 'cihaz',
  FIYAT: 'kiralık fiyatı',
  SAYAC: 'sayaç okuma',
  FATURA: 'ilk fatura',
  EKIP: 'ekip',
  FIS: 'servis fişi',
  TARAYICI: 'ağ tarayıcı',
  ARAC: 'araç',
  SOZLESME: 'sözleşme',
  WHATSAPP: 'WhatsApp',
  EFATURA: 'e-Fatura',
  PORTAL: 'müşteri portalı',
};

/**
 * Kurulum ilerlemesi: zorunlu adım sayısı her arttığında BİR sinyal (anahtar adım sayısını taşır),
 * hepsi bitince KURULUM_TAMAM. Hiç adım yoksa sinyal yok (DENEME_BASLADI zaten gidiyor).
 */
export function kurulumSinyali(s: {
  tenantId: string;
  kurulum: { zorunluTamam: number; zorunluToplam: number; hazir: boolean; sonrakiAdim: { kod: string } | null };
}): Sinyal | null {
  const { zorunluTamam: n, zorunluToplam: toplam, hazir, sonrakiAdim } = s.kurulum;
  if (hazir) {
    return { tur: 'KURULUM_TAMAM', baslik: `Kurulum tamam (${toplam}/${toplam})`, anahtar: `KURULUM_TAMAM:${s.tenantId}` };
  }
  if (n <= 0) return null;
  return {
    tur: 'KURULUM_ILERLEDI',
    baslik: `Kurulum ${n}/${toplam}`,
    ...(sonrakiAdim ? { detay: `Sıradaki: ${ADIM_ADI[sonrakiAdim.kod] ?? sonrakiAdim.kod}` } : {}),
    anahtar: `KURULUM:${s.tenantId}:${n}`,
  };
}

const BASLIK: Record<string, string> = {
  DURDURUYOR: 'Sorun bildirdi: işi durduruyor',
  YAVASLATIYOR: 'Sorun bildirdi: yavaşlatıyor',
  ONERI: 'Öneri yazdı',
};

/**
 * Ürün içinden "Sorun bildir" kaydı → CRM sinyali + Merkez geri bildirimi. Tür, ayıklandıysa kutudan
 * (HATA/ISTEK/BILGI_EKSIGI), yoksa bayinin seçtiğinden. Ekran görüntüsü gönderilmez; metni CRM maskeler.
 */
export function sorunSinyali(s: {
  id: string;
  tur: string;
  kutu: string | null;
  neYapiyordu: string | null;
  neOldu: string;
  sayfa: string | null;
  kullaniciAd: string | null;
  rol: string | null;
}): Sinyal {
  const gbTur: 'SORUN' | 'ISTEK' | 'SORU' =
    s.kutu === 'ISTEK' ? 'ISTEK' : s.kutu === 'BILGI_EKSIGI' ? 'SORU' : s.kutu === 'HATA' ? 'SORUN' : s.tur === 'ONERI' ? 'ISTEK' : 'SORUN';
  const metin = [
    s.neYapiyordu ? `Ne yapıyordu: ${s.neYapiyordu}` : null,
    `Ne oldu: ${s.neOldu}`,
    s.sayfa ? `Sayfa: ${s.sayfa.split('?')[0]}` : null,
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 4000);
  const kimden = s.kullaniciAd ? (s.rol ? `${s.kullaniciAd} (${s.rol.toLowerCase()})` : s.kullaniciAd) : null;
  return {
    tur: 'SORUN_BILDIRDI',
    baslik: BASLIK[s.tur] ?? 'Sorun bildirdi',
    detay: s.neOldu.slice(0, 200),
    anahtar: `SORUN:${s.id}`,
    geriBildirim: { tur: gbTur, metin, kimden, kaynakRef: `servis-sorun:${s.id}` },
  };
}
