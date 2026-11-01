// HAZIR BASKI ÜRÜNLERİ — matbaa hesabı açılınca fiyat listesine gelenler.
//
// Boş bir fiyat listesi ilk günün en büyük engeli: matbaa "fotokopi A4 tek
// yüz, 500'den sonra..." yapısını sıfırdan kurmaz, vazgeçer. Şablon yapıyı
// getirir (kademeler, seçenekler, cilt kalınlık aralıkları), FİYATI GETİRMEZ:
// her matbaanın fiyatı kendinin ve yanlış bir varsayılan fiyat müşteriye
// gerçek fiyat gibi gider. Fiyatı girilmeyen ürün sipariş sayfasında görünmez
// (baski-fiyat fiyatliMi). Fiyatı olmayan seçenek (ciltsiz, tek yüz) CARPAN 1:
// fiyat girilmesi gereken her BIRIM/SABIT değer 0 durur ve eksik sayılır.
//
// Saf: veritabanına dokunmaz. Kurulum tenant-manager (açılışta) ve
// baski-urun (sonradan, eksikleri) içinde.
import type { FiyatModeli, Kademe, SecenekGrubu } from './baski-fiyat';

export interface BaskiSablonu {
  kod: string;
  ad: { tr: string; en: string };
  kategori: 'FOTOKOPI' | 'PLAN' | 'BUYUK_BASKI' | 'CILT' | 'DIGER';
  fiyatModeli: FiyatModeli;
  kademeler: Kademe[];
  secenekler: SecenekGrubu[];
  teslimSaat: number | null;
  dosyaGerekli: boolean;
}

/** Fiyatı boş kademe listesi: yapı hazır, rakam matbaanın. */
const kademe = (...minler: number[]): Kademe[] => minler.map((min) => ({ min, fiyat: 0 }));

const YUZ: SecenekGrubu = {
  kod: 'yuz', ad: 'Yüz', zorunlu: true, degerler: [
    { kod: 'tek', ad: 'Tek yüz', tur: 'CARPAN', deger: 1, varsayilan: true },
    { kod: 'cift', ad: 'Çift yüz', tur: 'CARPAN', deger: 1, ciftYuz: true },
  ],
};

// Cilt nüsha başı, kalınlığa (nüsha başına yaprak) göre.
const CILT: SecenekGrubu = {
  kod: 'cilt', ad: 'Cilt', zorunlu: false, degerler: [
    { kod: 'yok', ad: 'Ciltsiz', tur: 'CARPAN', deger: 1, varsayilan: true },
    { kod: 'spiral', ad: 'Spiral', tur: 'BIRIM', taban: 'NUSHA', deger: 0, araliklar: [{ max: 50, deger: 0 }, { max: 100, deger: 0 }, { max: 200, deger: 0 }, { max: 400, deger: 0 }] },
    { kod: 'termal', ad: 'Termal', tur: 'BIRIM', taban: 'NUSHA', deger: 0, araliklar: [{ max: 100, deger: 0 }, { max: 250, deger: 0 }] },
  ],
};

const RENK: SecenekGrubu = {
  kod: 'renk', ad: 'Renk', zorunlu: true, degerler: [
    { kod: 'sb', ad: 'Siyah-beyaz', tur: 'CARPAN', deger: 1, varsayilan: true },
    { kod: 'renkli', ad: 'Renkli', tur: 'BIRIM', deger: 0 },
  ],
};

const fotokopi = (kod: string, tr: string, en: string): BaskiSablonu => ({
  kod, ad: { tr, en }, kategori: 'FOTOKOPI', fiyatModeli: 'SAYFA',
  kademeler: kademe(1, 100, 500, 1000), secenekler: [YUZ, CILT], teslimSaat: 1, dosyaGerekli: true,
});

const plan = (ebat: string): BaskiSablonu => ({
  kod: `plan-${ebat.toLowerCase()}`, ad: { tr: `Plan çıktı ${ebat}`, en: `Plan print ${ebat}` }, kategori: 'PLAN', fiyatModeli: 'ADET',
  kademeler: kademe(1, 10), secenekler: [RENK], teslimSaat: 2, dosyaGerekli: true,
});

export const BASKI_SABLONLARI: readonly BaskiSablonu[] = [
  fotokopi('fotokopi-a4-sb', 'Fotokopi A4 siyah-beyaz', 'Copy A4 black and white'),
  fotokopi('fotokopi-a4-renkli', 'Fotokopi A4 renkli', 'Copy A4 colour'),
  fotokopi('fotokopi-a3-sb', 'Fotokopi A3 siyah-beyaz', 'Copy A3 black and white'),
  fotokopi('fotokopi-a3-renkli', 'Fotokopi A3 renkli', 'Copy A3 colour'),
  plan('A2'), plan('A1'), plan('A0'),
  {
    kod: 'poster', ad: { tr: 'Poster', en: 'Poster' }, kategori: 'BUYUK_BASKI', fiyatModeli: 'ALAN',
    kademeler: kademe(1, 5), teslimSaat: 4, dosyaGerekli: true,
    secenekler: [{
      kod: 'malzeme', ad: 'Malzeme', zorunlu: true, degerler: [
        { kod: 'kuse', ad: 'Kuşe kâğıt', tur: 'CARPAN', deger: 1, varsayilan: true },
        { kod: 'mat', ad: 'Mat kâğıt', tur: 'CARPAN', deger: 1 },
        { kod: 'vinil', ad: 'Vinil (dış mekan)', tur: 'CARPAN', deger: 1 },
      ],
    }, {
      kod: 'kusgozu', ad: 'Kuşgözü', zorunlu: false, degerler: [
        { kod: 'yok', ad: 'Kuşgözüsüz', tur: 'CARPAN', deger: 1, varsayilan: true },
        { kod: 'dort', ad: '4 köşe kuşgözü', tur: 'BIRIM', taban: 'NUSHA', deger: 0 },
      ],
    }],
  },
  {
    kod: 'rollup', ad: { tr: 'Roll-up (85×200)', en: 'Roll-up banner (85×200)' }, kategori: 'BUYUK_BASKI', fiyatModeli: 'ADET',
    kademeler: kademe(1, 5), secenekler: [], teslimSaat: 24, dosyaGerekli: true,
  },
  {
    kod: 'canvas', ad: { tr: 'Canvas tablo', en: 'Canvas print' }, kategori: 'BUYUK_BASKI', fiyatModeli: 'ALAN',
    kademeler: kademe(1), teslimSaat: 24, dosyaGerekli: true,
    secenekler: [{
      kod: 'kasnak', ad: 'Kasnak', zorunlu: true, degerler: [
        { kod: 'var', ad: 'Kasnaklı', tur: 'BIRIM', taban: 'NUSHA', deger: 0, varsayilan: true },
        { kod: 'yok', ad: 'Kasnaksız (rulo)', tur: 'CARPAN', deger: 1 },
      ],
    }],
  },
  {
    kod: 'cilt-spiral', ad: { tr: 'Spiral cilt', en: 'Spiral binding' }, kategori: 'CILT', fiyatModeli: 'ADET',
    kademeler: kademe(1), teslimSaat: 1, dosyaGerekli: false,
    secenekler: [{
      kod: 'kalinlik', ad: 'Kalınlık', zorunlu: true, degerler: [
        { kod: '50', ad: '50 yaprağa kadar', tur: 'CARPAN', deger: 1, varsayilan: true },
        { kod: '100', ad: '51–100 yaprak', tur: 'BIRIM', taban: 'NUSHA', deger: 0 },
        { kod: '200', ad: '101–200 yaprak', tur: 'BIRIM', taban: 'NUSHA', deger: 0 },
      ],
    }],
  },
  {
    kod: 'cilt-termal', ad: { tr: 'Termal cilt', en: 'Thermal binding' }, kategori: 'CILT', fiyatModeli: 'ADET',
    kademeler: kademe(1), secenekler: [], teslimSaat: 1, dosyaGerekli: false,
  },
  {
    kod: 'laminasyon', ad: { tr: 'Laminasyon', en: 'Lamination' }, kategori: 'DIGER', fiyatModeli: 'ADET',
    kademeler: kademe(1, 50), teslimSaat: 1, dosyaGerekli: false,
    secenekler: [{
      kod: 'ebat', ad: 'Ebat', zorunlu: true, degerler: [
        { kod: 'a4', ad: 'A4', tur: 'CARPAN', deger: 1, varsayilan: true },
        { kod: 'a3', ad: 'A3', tur: 'CARPAN', deger: 1 },
      ],
    }],
  },
  {
    kod: 'kase', ad: { tr: 'Kaşe', en: 'Rubber stamp' }, kategori: 'DIGER', fiyatModeli: 'SABIT',
    kademeler: kademe(1), teslimSaat: 24, dosyaGerekli: false,
    secenekler: [{
      kod: 'tur', ad: 'Tür', zorunlu: true, degerler: [
        { kod: 'otomatik', ad: 'Otomatik', tur: 'CARPAN', deger: 1, varsayilan: true },
        { kod: 'tahta', ad: 'Tahta saplı', tur: 'CARPAN', deger: 1 },
      ],
    }],
  },
  {
    kod: 'tarama', ad: { tr: 'Tarama (sayfa)', en: 'Scanning (per page)' }, kategori: 'DIGER', fiyatModeli: 'ADET',
    kademeler: kademe(1, 100), secenekler: [], teslimSaat: 1, dosyaGerekli: false,
  },
];

/** Kiracıya yazılacak satırlar; `mevcut` kodlar atlanır (ikinci kurulum çoğaltmasın). */
export function sablonSatirlari(dil: string | null | undefined, mevcut: readonly (string | null)[] = []) {
  const en = dil === 'en';
  return BASKI_SABLONLARI
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !mevcut.includes(s.kod))
    .map(({ s, i }) => ({
      ad: en ? s.ad.en : s.ad.tr,
      kategori: s.kategori,
      fiyatModeli: s.fiyatModeli,
      kademeler: s.kademeler,
      secenekler: s.secenekler,
      teslimSaat: s.teslimSaat,
      dosyaGerekli: s.dosyaGerekli,
      sira: (i + 1) * 10,
      sablonKodu: s.kod,
    }));
}
