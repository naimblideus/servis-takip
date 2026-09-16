/**
 * NÖBETÇİ CÜMLELERİ — tek yerde.
 *
 * Kontroller sunucuda Türkçe cümle kuruyordu. Artık KOD dönüyorlar (sayılar
 * ayrı alanda) ve cümle burada, OKUYANIN dilinde kuruluyor.
 *
 * Üç okuyucu var ve üçü de aynı cümleyi görmeli:
 *   · süper admin ekranı — kullanıcının kendi dili
 *   · alarm webhook'u (Slack/Discord) — sunucuda, platform dilinde
 *   · cron kaydı (console) — sunucuda, platform dilinde
 * Ekranda başka, alarmda başka yazarsa aynı arıza iki farklı olay sanılır.
 *
 * Bu dosya SAFtır: React yok, Prisma yok.
 */
import { doldur, type Sozluk } from './i18n/sozluk';

/** Kontrolün adı — ekranda başlık, alarmda satır başı. */
export type KontrolAdi =
  | 'VERITABANI'
  | 'DISK'
  | 'FATURA_CRON'
  | 'WHATSAPP'
  | 'SAYAC_EPOSTA'
  | 'BILDIRIM_KUYRUGU'
  | 'DENETIM_KAYDI';

/**
 * Kontrolün bulgusu. Sayı ve serbest metin (veritabanı hedefi, hata metni)
 * ayrı alanda: çeviri cümleyi kurar, veriyi üretmez.
 */
export type MesajKod =
  // — veritabanı —
  | { kod: 'DB_BOS'; hedef: string }
  | { kod: 'DB_YAVAS'; ms: number; hedef: string }
  | { kod: 'DB_OK'; ms: number; bayi: number; hedef: string }
  | { kod: 'DB_YOK'; hedef: string; hata: string }
  // — disk —
  | { kod: 'DISK_OLCULEMEDI' }
  | { kod: 'DISK_DESTEKSIZ' }
  | { kod: 'DISK_DOLU'; yuzde: number; bosGB: number }
  | { kod: 'DISK_OK'; yuzde: number; bosGB: number }
  // — aylık faturalama —
  | { kod: 'FATURA_AY_BASI' }
  | { kod: 'FATURA_KIRALIK_YOK' }
  | { kod: 'FATURA_URETILMEMIS'; cihaz: number }
  | { kod: 'FATURA_ADET'; adet: number }
  // — whatsapp —
  | { kod: 'WA_KURULU_YOK' }
  | { kod: 'WA_HIC_MESAJ'; bayi: number }
  | { kod: 'WA_SESSIZ'; gun: number; bayi: number }
  | { kod: 'WA_SON_BUGUN' }
  | { kod: 'WA_SON_GUN'; gun: number }
  // — sayaç e-postası —
  | { kod: 'SE_KULLANILMIYOR' }
  | { kod: 'SE_SESSIZ'; gun: number }
  | { kod: 'SE_KUYRUK'; adet: number }
  | { kod: 'SE_BEKLEYEN'; adet: number }
  | { kod: 'SE_TEMIZ' }
  // — bildirim kuyruğu —
  | { kod: 'BK_TAKILI'; adet: number }
  | { kod: 'BK_BEKLEYEN'; adet: number }
  | { kod: 'BK_TEMIZ' }
  | { kod: 'BK_OKUNAMADI' }
  // — denetim kaydı —
  | { kod: 'DZ_KAYIT_YOK' }
  | { kod: 'DZ_HASHSIZ'; adet: number }
  | { kod: 'DZ_ADET'; adet: number }
  // — kontrolün kendisi patladı —
  | { kod: 'KONTROL_PATLADI'; hata: string };

/** İnsanın atacağı ilk adım. Yalnız sorun varken dolu. */
export type NedenKod =
  | 'DB_BOS'
  | 'DB_YAVAS'
  | 'DB_YEREL'
  | 'DB_YOK'
  | 'DISK_KRITIK'
  | 'DISK_UYARI'
  | 'FATURA_CRON'
  | 'WA_ABONELIK'
  | 'WA_WEBHOOK'
  | 'SE_YONLENDIRME'
  | 'SE_KUYRUK'
  | 'BK_ANAHTAR'
  | 'DZ_HASHSIZ';

export function kontrolAdi(sz: Sozluk, kod: KontrolAdi): string {
  return sz.nobetci.ad[kod];
}

export function kontrolNedeni(sz: Sozluk, kod: NedenKod | undefined): string {
  return kod ? sz.nobetci.neden[kod] : '';
}

/**
 * Bulgunun cümlesi. Veritabanı hedefi ("nextus @ db.example") ve hata metni
 * çevrilmez — makine adı ve sürücü mesajıdır, çevirisi yanlış olur.
 */
export function kontrolMesaji(sz: Sozluk, m: MesajKod): string {
  const n = sz.nobetci.mesaj;
  switch (m.kod) {
    case 'DB_BOS': return doldur(n.dbBos, { hedef: m.hedef });
    case 'DB_YAVAS': return doldur(n.dbYavas, { ms: m.ms, hedef: m.hedef });
    case 'DB_OK': return doldur(n.dbOk, { ms: m.ms, bayi: m.bayi, hedef: m.hedef });
    case 'DB_YOK': return doldur(n.dbYok, { hedef: m.hedef, hata: m.hata });

    case 'DISK_OLCULEMEDI': return n.diskOlculemedi;
    case 'DISK_DESTEKSIZ': return n.diskDesteksiz;
    case 'DISK_DOLU': return doldur(n.diskDolu, { yuzde: m.yuzde, gb: m.bosGB });
    case 'DISK_OK': return doldur(n.diskOk, { yuzde: m.yuzde, gb: m.bosGB });

    case 'FATURA_AY_BASI': return n.faturaAyBasi;
    case 'FATURA_KIRALIK_YOK': return n.faturaKiralikYok;
    case 'FATURA_URETILMEMIS': return doldur(n.faturaUretilmemis, { n: m.cihaz });
    case 'FATURA_ADET': return doldur(n.faturaAdet, { n: m.adet });

    case 'WA_KURULU_YOK': return n.waKuruluYok;
    case 'WA_HIC_MESAJ': return doldur(n.waHicMesaj, { n: m.bayi });
    case 'WA_SESSIZ': return doldur(n.waSessiz, { gun: m.gun, n: m.bayi });
    case 'WA_SON_BUGUN': return n.waSonBugun;
    case 'WA_SON_GUN': return doldur(n.waSonGun, { gun: m.gun });

    case 'SE_KULLANILMIYOR': return n.seKullanilmiyor;
    case 'SE_SESSIZ': return doldur(n.seSessiz, { gun: m.gun });
    case 'SE_KUYRUK': return doldur(n.seKuyruk, { n: m.adet });
    case 'SE_BEKLEYEN': return doldur(n.seBekleyen, { n: m.adet });
    case 'SE_TEMIZ': return n.seTemiz;

    case 'BK_TAKILI': return doldur(n.bkTakili, { n: m.adet });
    case 'BK_BEKLEYEN': return doldur(n.bkBekleyen, { n: m.adet });
    case 'BK_TEMIZ': return n.bkTemiz;
    case 'BK_OKUNAMADI': return n.bkOkunamadi;

    case 'DZ_KAYIT_YOK': return n.dzKayitYok;
    case 'DZ_HASHSIZ': return doldur(n.dzHashsiz, { n: m.adet });
    case 'DZ_ADET': return doldur(n.dzAdet, { n: m.adet });

    case 'KONTROL_PATLADI': return doldur(n.kontrolPatladi, { hata: m.hata });
  }
}

/** "2 kritik, 1 uyarı" · "1 uyarı" · "Her şey yolunda" */
export function nobetciOzeti(sz: Sozluk, kritik: number, uyari: number): string {
  if (kritik) return doldur(sz.nobetci.ozetKritik, { k: kritik, u: uyari });
  if (uyari) return doldur(sz.nobetci.ozetUyari, { u: uyari });
  return sz.nobetci.ozetIyi;
}
