// SAHTE R2 — yerelde dosya yüklemeyi denemek için küçük bir S3 taklidi.
// Çalıştır:  node scripts/sahte-r2.mjs [port]      (varsayılan 9333)
//
// Uygulamanın kullandığı altı çağrıyı karşılar: çok parçalı yüklemeyi açma,
// parça yükleme, parçaları listeleme, kapatma, iptal; nesne okuma ve silme.
// Dosyalar geçici klasöre yazılır, süreç kapanınca silinir. İMZAYI
// DOĞRULAMAZ (imza scripts/test-baski-dosya.mjs içinde AWS örnekleriyle
// sınanıyor); yalnız imza parametrelerinin GELDİĞİNE bakar. Üretimde kullanılmaz.
//
// .env.local örneği:
//   R2_ENDPOINT=http://localhost:9333
//   R2_BUCKET=deneme
//   R2_ACCESS_KEY_ID=yerel
//   R2_SECRET_ACCESS_KEY=yerel
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function sahteR2(port = 9333) {
  const kok = mkdtempSync(join(tmpdir(), 'sahte-r2-'));
  const yuklemeler = new Map(); // uploadId → { anahtar, parcalar: Map<no, {etag, boyut, yol}> }
  const dosyaYolu = (anahtar) => join(kok, createHash('sha1').update(anahtar).digest('hex'));
  const xml = (res, durum, govde) => { res.writeHead(durum, { 'content-type': 'application/xml' }); res.end(govde); };
  const hata = (res, durum, kod) => xml(res, durum, `<Error><Code>${kod}</Code></Error>`);

  const sunucu = createServer(async (req, res) => {
    // Tarayıcıdan doğrudan PUT: CORS (gerçek bucket'ta da aynı kural gerekir).
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-methods', 'GET, PUT, POST, DELETE, HEAD');
    res.setHeader('access-control-allow-headers', '*');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const u = new URL(req.url, `http://${req.headers.host}`);
    const anahtar = decodeURIComponent(u.pathname.replace(/^\/[^/]+\//, ''));
    const imzali = u.searchParams.has('X-Amz-Signature') || /^AWS4-HMAC-SHA256 /.test(req.headers.authorization ?? '');
    if (!imzali) return hata(res, 403, 'AccessDenied');
    const parcalar = [];
    for await (const p of req) parcalar.push(p);
    const govde = Buffer.concat(parcalar);
    const kimlik = u.searchParams.get('uploadId');

    if (req.method === 'POST' && u.searchParams.has('uploads')) {
      const id = randomBytes(12).toString('hex');
      yuklemeler.set(id, { anahtar, parcalar: new Map() });
      return xml(res, 200, `<InitiateMultipartUploadResult><UploadId>${id}</UploadId></InitiateMultipartUploadResult>`);
    }
    if (kimlik) {
      const y = yuklemeler.get(kimlik);
      if (!y || y.anahtar !== anahtar) return hata(res, 404, 'NoSuchUpload');
      if (req.method === 'PUT') {
        const no = Number(u.searchParams.get('partNumber'));
        const etag = `"${createHash('md5').update(govde).digest('hex')}"`;
        const yol = join(kok, `${kimlik}.${no}`);
        writeFileSync(yol, govde);
        y.parcalar.set(no, { etag, boyut: govde.length, yol });
        res.writeHead(200, { etag });
        return res.end();
      }
      if (req.method === 'GET') {
        const l = [...y.parcalar.entries()].sort((a, b) => a[0] - b[0]);
        return xml(res, 200, `<ListPartsResult>${l.map(([no, p]) => `<Part><PartNumber>${no}</PartNumber><ETag>${p.etag.replace(/"/g, '&quot;')}</ETag><Size>${p.boyut}</Size></Part>`).join('')}</ListPartsResult>`);
      }
      if (req.method === 'POST') {
        const l = [...y.parcalar.entries()].sort((a, b) => a[0] - b[0]);
        writeFileSync(dosyaYolu(anahtar), Buffer.concat(l.map(([, p]) => readFileSync(p.yol))));
        for (const [, p] of l) unlinkSync(p.yol);
        yuklemeler.delete(kimlik);
        return xml(res, 200, '<CompleteMultipartUploadResult></CompleteMultipartUploadResult>');
      }
      if (req.method === 'DELETE') {
        for (const [, p] of y.parcalar) if (existsSync(p.yol)) unlinkSync(p.yol);
        yuklemeler.delete(kimlik);
        res.writeHead(204);
        return res.end();
      }
    }
    const yol = dosyaYolu(anahtar);
    if (req.method === 'GET' || req.method === 'HEAD') {
      if (!existsSync(yol)) return hata(res, 404, 'NoSuchKey');
      const basliklar = { 'content-length': statSync(yol).size };
      const disp = u.searchParams.get('response-content-disposition');
      if (disp) basliklar['content-disposition'] = disp;
      res.writeHead(200, basliklar);
      return res.end(req.method === 'HEAD' ? undefined : readFileSync(yol));
    }
    if (req.method === 'DELETE') {
      if (existsSync(yol)) unlinkSync(yol);
      res.writeHead(204);
      return res.end();
    }
    return hata(res, 400, 'NotImplemented');
  });
  return {
    kok,
    nesneSayisi: () => readdirSync(kok).filter((f) => !f.includes('.')).length,
    baslat: () => new Promise((coz) => sunucu.listen(port, () => coz(`http://localhost:${port}`))),
    kapat: () => new Promise((coz) => sunucu.close(() => { rmSync(kok, { recursive: true, force: true }); coz(); })),
  };
}

// Doğrudan çalıştırıldıysa sunucuyu aç.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const r2 = sahteR2(Number(process.argv[2]) || 9333);
  mkdirSync(r2.kok, { recursive: true });
  console.log(`sahte R2: ${await r2.baslat()}  (dosyalar: ${r2.kok})`);
  process.on('SIGINT', async () => { await r2.kapat(); process.exit(0); });
}
