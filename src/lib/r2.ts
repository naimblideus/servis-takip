// CLOUDFLARE R2 — imzalı adresler ve sunucu çağrıları (S3 uyumlu, SigV4).
//
// ── NEDEN ELLE ───────────────────────────────────────────────────────────
// AWS SDK bu iş için onlarca paket getiriyor; sunucuda derleme zaten bellek
// sınırında (bkz. `next build --webpack`). İhtiyaç dar: imzalı adres üretmek
// ve beş küçük çağrı. İmza algoritması yayımlanmış ve sabit; AWS'nin kendi
// örnek imzalarıyla test ediliyor (scripts/test-baski-dosya.mjs).
//
// ── AKIŞ ─────────────────────────────────────────────────────────────────
// Dosya gövdesi sunucudan GEÇMEZ: tarayıcı parçaları imzalı adreslere
// doğrudan yükler. Sunucu yalnız yüklemeyi açar, parça adresi imzalar ve
// kapatır. Kapatırken parça listesini R2'den kendisi okur: tarayıcının
// bildirdiği listeye güvenilmez, bucket'ın ETag başlığını tarayıcıya açması
// da gerekmez.
//
// Ortam: R2_ENDPOINT (https://<hesap>.r2.cloudflarestorage.com), R2_BUCKET,
// R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY. Biri eksikse dosya yükleme kapalıdır.
import { createHash, createHmac } from 'node:crypto';

export interface R2Ayar {
  /** Şema + sunucu, sonda / yok. */
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

export function r2Ayari(env: Record<string, string | undefined> = process.env): R2Ayar | null {
  const endpoint = (env.R2_ENDPOINT ?? '').trim().replace(/\/+$/, '');
  const bucket = (env.R2_BUCKET ?? '').trim();
  const accessKeyId = (env.R2_ACCESS_KEY_ID ?? '').trim();
  const secretAccessKey = (env.R2_SECRET_ACCESS_KEY ?? '').trim();
  if (!/^https?:\/\/[^/]+$/.test(endpoint) || !bucket || !accessKeyId || !secretAccessKey) return null;
  return { endpoint, bucket, accessKeyId, secretAccessKey, region: (env.R2_REGION ?? '').trim() || 'auto' };
}
export const r2Ayarli = () => r2Ayari() !== null;

// ── SigV4 ────────────────────────────────────────────────────────────────

const sha256 = (s: string | Uint8Array) => createHash('sha256').update(s).digest('hex');
const hmac = (anahtar: string | Buffer, s: string) => createHmac('sha256', anahtar).update(s).digest();

/** RFC 3986: harf, rakam ve -._~ dışındaki her şey %XX. */
export const kodla = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const yolKodla = (yol: string) => yol.split('/').map(kodla).join('/');
const sorguYaz = (s: Record<string, string>) => Object.keys(s).map((k) => [kodla(k), kodla(s[k])]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join('&');

function zamanDamgasi(d: Date) {
  const tam = d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return { tam, gun: tam.slice(0, 8) };
}

function imzaAnahtari(gizli: string, gun: string, bolge: string) {
  return hmac(hmac(hmac(hmac(`AWS4${gizli}`, gun), bolge), 's3'), 'aws4_request');
}

export interface ImzaGirdisi {
  yontem: string;
  /** "ornek.r2.cloudflarestorage.com" */
  sunucu: string;
  /** Kodlanmamış yol: "/bucket/klasor/dosya adı.pdf" */
  yol: string;
  sorgu?: Record<string, string>;
  kimlik: { accessKeyId: string; secretAccessKey: string; region: string };
  simdi?: Date;
}

/** Sorguya imza eklenmiş adresin sorgu kısmı (X-Amz-Signature dahil). Gövde imzalanmaz. */
export function sorguImzasi(g: ImzaGirdisi & { saniye: number }): string {
  const { tam, gun } = zamanDamgasi(g.simdi ?? new Date());
  const kapsam = `${gun}/${g.kimlik.region}/s3/aws4_request`;
  const sorgu = sorguYaz({
    ...(g.sorgu ?? {}),
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${g.kimlik.accessKeyId}/${kapsam}`,
    'X-Amz-Date': tam,
    'X-Amz-Expires': String(Math.floor(g.saniye)),
    'X-Amz-SignedHeaders': 'host',
  });
  const istek = [g.yontem, yolKodla(g.yol), sorgu, `host:${g.sunucu}`, '', 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const metin = ['AWS4-HMAC-SHA256', tam, kapsam, sha256(istek)].join('\n');
  const imza = hmac(imzaAnahtari(g.kimlik.secretAccessKey, gun, g.kimlik.region), metin).toString('hex');
  return `${sorgu}&X-Amz-Signature=${imza}`;
}

/** Başlıkla imzalanan istek (sunucudan R2'ye). Gönderilecek başlıkları döner. */
export function baslikImzasi(g: ImzaGirdisi & { basliklar?: Record<string, string>; govde?: string }): Record<string, string> {
  const { tam, gun } = zamanDamgasi(g.simdi ?? new Date());
  const kapsam = `${gun}/${g.kimlik.region}/s3/aws4_request`;
  const govdeOzeti = sha256(g.govde ?? '');
  const b: Record<string, string> = { host: g.sunucu, 'x-amz-content-sha256': govdeOzeti, 'x-amz-date': tam };
  for (const [k, v] of Object.entries(g.basliklar ?? {})) b[k.toLowerCase()] = v.trim().replace(/\s+/g, ' ');
  const adlar = Object.keys(b).sort();
  const istek = [g.yontem, yolKodla(g.yol), sorguYaz(g.sorgu ?? {}), ...adlar.map((k) => `${k}:${b[k]}`), '', adlar.join(';'), govdeOzeti].join('\n');
  const metin = ['AWS4-HMAC-SHA256', tam, kapsam, sha256(istek)].join('\n');
  const imza = hmac(imzaAnahtari(g.kimlik.secretAccessKey, gun, g.kimlik.region), metin).toString('hex');
  const { host: _host, ...gonderilecek } = b;
  void _host;
  return { ...gonderilecek, authorization: `AWS4-HMAC-SHA256 Credential=${g.kimlik.accessKeyId}/${kapsam}, SignedHeaders=${adlar.join(';')}, Signature=${imza}` };
}

// ── R2 İŞLEMLERİ ─────────────────────────────────────────────────────────

const sunucu = (a: R2Ayar) => a.endpoint.replace(/^https?:\/\//, '');
const nesneYolu = (a: R2Ayar, anahtar: string) => `/${a.bucket}/${anahtar}`;

function imzaliAdres(a: R2Ayar, yontem: string, anahtar: string, saniye: number, sorgu?: Record<string, string>): string {
  const yol = nesneYolu(a, anahtar);
  return `${a.endpoint}${yolKodla(yol)}?${sorguImzasi({ yontem, sunucu: sunucu(a), yol, sorgu, saniye, kimlik: a })}`;
}

async function cagir(a: R2Ayar, yontem: string, anahtar: string, o: { sorgu?: Record<string, string>; govde?: string; basliklar?: Record<string, string> } = {}): Promise<Response> {
  const yol = nesneYolu(a, anahtar);
  const basliklar = baslikImzasi({ yontem, sunucu: sunucu(a), yol, sorgu: o.sorgu, basliklar: o.basliklar, govde: o.govde, kimlik: a });
  const s = sorguYaz(o.sorgu ?? {});
  return fetch(`${a.endpoint}${yolKodla(yol)}${s ? `?${s}` : ''}`, { method: yontem, headers: basliklar, body: o.govde, signal: AbortSignal.timeout(30_000) });
}

export class R2Hatasi extends Error {
  constructor(public islem: string, public durum: number, ayrinti: string) { super(`R2 ${islem} ${durum}: ${ayrinti.slice(0, 300)}`); }
}
const etiket = (xml: string, ad: string) => new RegExp(`<${ad}>([^<]*)</${ad}>`).exec(xml)?.[1] ?? null;
const xmlCoz = (s: string) => s.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const xmlYaz = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Çok parçalı yüklemeyi açar; yükleme kimliğini döner. */
export async function yuklemeBaslat(a: R2Ayar, anahtar: string, mime: string): Promise<string> {
  const r = await cagir(a, 'POST', anahtar, { sorgu: { uploads: '' }, basliklar: { 'content-type': mime } });
  const xml = await r.text();
  const kimlik = etiket(xml, 'UploadId');
  if (!r.ok || !kimlik) throw new R2Hatasi('baslat', r.status, xml);
  return kimlik;
}

/** Tarayıcının bir parçayı doğrudan yükleyeceği adres (PUT). */
export function parcaAdresi(a: R2Ayar, anahtar: string, yuklemeId: string, parcaNo: number, saniye: number): string {
  return imzaliAdres(a, 'PUT', anahtar, saniye, { partNumber: String(parcaNo), uploadId: yuklemeId });
}

/** Yüklenmiş parçalar (R2'nin gördüğü). 1000 parçaya kadar; bizim sınırımız 40. */
export async function parcalariOku(a: R2Ayar, anahtar: string, yuklemeId: string): Promise<{ no: number; etag: string; boyut: number }[]> {
  const r = await cagir(a, 'GET', anahtar, { sorgu: { uploadId: yuklemeId } });
  const xml = await r.text();
  if (!r.ok) throw new R2Hatasi('parcalar', r.status, xml);
  return [...xml.matchAll(/<Part>([\s\S]*?)<\/Part>/g)].map((m) => ({
    no: Number(etiket(m[1], 'PartNumber')), etag: xmlCoz(etiket(m[1], 'ETag') ?? ''), boyut: Number(etiket(m[1], 'Size')),
  })).filter((p) => p.no > 0 && p.etag).sort((x, y) => x.no - y.no);
}

/** Yüklemeyi kapatır: parçalar tek nesne olur. */
export async function yuklemeBitir(a: R2Ayar, anahtar: string, yuklemeId: string, parcalar: readonly { no: number; etag: string }[]): Promise<void> {
  const govde = `<CompleteMultipartUpload>${parcalar.map((p) => `<Part><PartNumber>${p.no}</PartNumber><ETag>${xmlYaz(p.etag)}</ETag></Part>`).join('')}</CompleteMultipartUpload>`;
  const r = await cagir(a, 'POST', anahtar, { sorgu: { uploadId: yuklemeId }, govde, basliklar: { 'content-type': 'application/xml' } });
  const xml = await r.text();
  // S3 kapatma hatasını 200 ile de dönebilir: gövdeye bakılır.
  if (!r.ok || /<Error>/.test(xml)) throw new R2Hatasi('bitir', r.status, xml);
}

/** Yarım kalan yüklemeyi atar (parçalar yer tutmasın). Hata vermez. */
export async function yuklemeIptal(a: R2Ayar, anahtar: string, yuklemeId: string): Promise<void> {
  await cagir(a, 'DELETE', anahtar, { sorgu: { uploadId: yuklemeId } }).catch(() => null);
}

/** Nesneyi siler. Yoksa da başarılı sayılır (ikinci silme zararsız). */
export async function nesneSil(a: R2Ayar, anahtar: string): Promise<boolean> {
  const r = await cagir(a, 'DELETE', anahtar).catch(() => null);
  return !!r && (r.ok || r.status === 404);
}

/** 5 dakikalık indirme adresi. `satirIci` görüntülemek için (prova), değilse dosya iner. */
export function indirmeAdresi(a: R2Ayar, anahtar: string, ad: string, saniye: number, satirIci = false): string {
  // Başlıktaki dosya adı: ASCII yedeği + UTF-8 asıl ad (Türkçe karakterli adlar).
  const duz = ad.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const disp = `${satirIci ? 'inline' : 'attachment'}; filename="${duz}"; filename*=UTF-8''${kodla(ad)}`;
  return imzaliAdres(a, 'GET', anahtar, saniye, { 'response-content-disposition': disp });
}
