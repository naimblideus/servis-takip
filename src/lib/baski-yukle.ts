// BASKI DOSYASI YÜKLEME — tarayıcı tarafı (sunucuda çalışmaz).
//
// Dosya sunucumuzdan GEÇMEZ: parçalar imzalı adreslerle doğrudan depoya
// yüklenir, sunucu yalnız açar ve kapatır. Ön kontrol de burada, tarayıcıda:
// sayfa sayısı ve ölçü dosyadan okunur, sunucuya yük binmez. Bu dosyada ağır
// kitaplık yok; müşteri dosya seçmeden hiçbir ek istek atılmaz.
import { dosyaTuru, dpiDusukMu, ebatAdi, ON_KONTROL_AZAMI, pdfOlcu, pdfSayfaSay } from './baski-dosya';

export type YuklemeHedefi =
  | { tur: 'MUSTERI'; kisaAd: string; jeton: string }
  | { tur: 'PERSONEL'; isId: string; dosyaTuru?: 'BASKI' | 'PROVA' };

export interface OnKontrol {
  sayfaSayisi: number | null;
  olcu: string | null;
  uyarilar: string[];
  /** Görselde piksel ölçüsü (çözünürlük uyarısı için). */
  piksel?: { en: number; boy: number };
}

/** Sıkıştırılmış nesne akışlarını (PDF 1.5+) açar: sayfa ağacı çoğu zaman bunların içinde. */
async function nesneAkislari(bayt: Uint8Array, metin: string): Promise<string> {
  if (typeof DecompressionStream === 'undefined') return '';
  let acik = '';
  let n = 0;
  for (const m of metin.matchAll(/\/Type\s*\/ObjStm/g)) {
    if (++n > 400 || acik.length > 40_000_000) break;
    const bas = metin.indexOf('stream', m.index ?? 0);
    if (bas < 0 || bas - (m.index ?? 0) > 2000) continue;
    let veri = bas + 6;
    if (metin[veri] === '\r') veri++;
    if (metin[veri] === '\n') veri++;
    const son = metin.indexOf('endstream', veri);
    if (son < 0) continue;
    try {
      const akis = new Blob([bayt.slice(veri, son)]).stream().pipeThrough(new DecompressionStream('deflate'));
      acik += `\n${new TextDecoder('latin1').decode(await new Response(akis).arrayBuffer())}`;
    } catch { /* bu akış açılmadı (şifreli ya da başka süzgeç): diğerlerine bakılır */ }
  }
  return acik;
}

/**
 * Dosyaya yüklemeden önce bakar. Okuyamadığı şeyi uydurmaz: sayfa sayısı
 * çıkmazsa null döner ve uyarı ekler; müşteri sayıyı elle yazar.
 * `olcuCm` verilirse (afiş, poster) görselin çözünürlüğü o ölçüye göre denetlenir.
 */
export async function onKontrol(dosya: File, olcuCm?: { en: number; boy: number } | null): Promise<OnKontrol> {
  const tur = dosyaTuru(dosya.name);
  const out: OnKontrol = { sayfaSayisi: null, olcu: null, uyarilar: [] };
  try {
    if (tur === 'application/pdf') {
      if (dosya.size > ON_KONTROL_AZAMI) { out.uyarilar.push('SAYFA_OKUNAMADI'); return out; }
      const bayt = new Uint8Array(await dosya.arrayBuffer());
      const metin = new TextDecoder('latin1').decode(bayt);
      const tam = /\/ObjStm/.test(metin) ? `${metin}\n${await nesneAkislari(bayt, metin)}` : metin;
      out.sayfaSayisi = pdfSayfaSay(tam);
      const o = pdfOlcu(tam);
      if (o) out.olcu = ebatAdi(o.enMm, o.boyMm);
      if (out.sayfaSayisi === null) out.uyarilar.push(/\/Encrypt\b/.test(metin) ? 'SIFRELI' : 'SAYFA_OKUNAMADI');
    } else if (tur === 'image/jpeg' || tur === 'image/png') {
      const resim = await createImageBitmap(dosya);
      out.piksel = { en: resim.width, boy: resim.height };
      out.olcu = `${resim.width}×${resim.height} px`;
      resim.close();
      if (olcuCm && dpiDusukMu(out.piksel.en, out.piksel.boy, olcuCm.en, olcuCm.boy)) out.uyarilar.push('DUSUK_COZUNURLUK');
    }
  } catch { /* okunamadı: ön kontrol kolaylıktır, yükleme yine yapılır */ }
  return out;
}

async function cagir(yol: string, govde: Record<string, unknown>): Promise<{ ok: boolean; j: Record<string, unknown> }> {
  const r = await fetch(`/api/b/dosya/${yol}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(govde) }).catch(() => null);
  const j = r ? ((await r.json().catch(() => ({}))) as Record<string, unknown>) : {};
  return { ok: !!r?.ok, j };
}

/** Bir parçayı imzalı adrese yükler; ilerleme bayt olarak bildirilir. */
function parcaGonder(url: string, parca: Blob, ilerleme: (bayt: number) => void, iptal?: AbortSignal): Promise<boolean> {
  return new Promise((coz) => {
    const x = new XMLHttpRequest();
    x.open('PUT', url);
    x.upload.onprogress = (e) => ilerleme(e.loaded);
    x.onload = () => coz(x.status >= 200 && x.status < 300);
    x.onerror = () => coz(false);
    x.onabort = () => coz(false);
    iptal?.addEventListener('abort', () => x.abort(), { once: true });
    x.send(parca);
  });
}

/**
 * Dosyayı yükler: aç → parçalar (her biri en çok 3 deneme) → kapat.
 * Hata olursa yarım yükleme atılır ve sunucunun hata cümlesi döner.
 */
export async function dosyaYukle(
  dosya: File, hedef: YuklemeHedefi, bilgi: OnKontrol | null, ilerleme: (yuzde: number) => void, iptal?: AbortSignal,
): Promise<{ ok: true; dosyaId: string } | { ok: false; hata: string | null }> {
  const kimlik = hedef.tur === 'MUSTERI' ? { kisaAd: hedef.kisaAd, jeton: hedef.jeton } : { isId: hedef.isId };
  const ac = await cagir('baslat', {
    ...kimlik, ad: dosya.name, boyut: dosya.size, tur: hedef.tur === 'PERSONEL' ? hedef.dosyaTuru : undefined,
    sayfaSayisi: bilgi?.sayfaSayisi ?? undefined, olcu: bilgi?.olcu ?? undefined, uyarilar: bilgi?.uyarilar ?? [],
  });
  if (!ac.ok) return { ok: false, hata: (ac.j.error as string) ?? null };
  const dosyaId = String(ac.j.dosyaId);
  const parcaBoyu = Number(ac.j.parcaBoyu), parca = Number(ac.j.parca);
  const vazgec = async (hata: string | null) => { await cagir('bitir', { ...kimlik, dosyaId, vazgec: true }); return { ok: false as const, hata }; };

  for (let no = 1; no <= parca; no++) {
    const dilim = dosya.slice((no - 1) * parcaBoyu, Math.min(no * parcaBoyu, dosya.size));
    let tamam = false;
    for (let deneme = 0; deneme < 3 && !tamam; deneme++) {
      if (iptal?.aborted) return vazgec(null);
      const a = await cagir('parca', { ...kimlik, dosyaId, no });
      if (!a.ok) { if (deneme === 2) return vazgec((a.j.error as string) ?? null); continue; }
      tamam = await parcaGonder(String(a.j.url), dilim, (b) => ilerleme(Math.min(99, Math.round((((no - 1) * parcaBoyu + b) / dosya.size) * 100))), iptal);
      if (!tamam) await new Promise((r) => setTimeout(r, 800 * (deneme + 1)));
    }
    if (!tamam) return vazgec(null);
  }
  const kapat = await cagir('bitir', { ...kimlik, dosyaId });
  if (!kapat.ok) return vazgec((kapat.j.error as string) ?? null);
  ilerleme(100);
  return { ok: true, dosyaId };
}
