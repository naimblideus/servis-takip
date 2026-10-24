// ORTAK DERLEYİCİ — testlerin src altındaki TypeScript modüllerini içe
// aktarabilmesi için.
//
// NEDEN BU DOSYA
// Her test hangi dosyaların derleneceğini ve '@/lib/x' yollarının neye
// çevrileceğini elle listeliyordu. invoicing.ts ya da readings.ts yeni bir
// '@/lib/...' modülü içe aktarınca bu testlerin hepsi ERR_MODULE_NOT_FOUND
// ile düşüyordu (2026-10-24: fatura-donemi + fatura-turu → 13 test).
//
// Burada liste YOK: girişlerden başlayıp içe aktarmaları tarar, geçişli
// kapanışı tek tsc çağrısıyla derler ve üretilen her .js dosyasında yolları
// o dosyaya göre düzeltir.
//
//   const { dizin, ice, prismaIstemci } = derle({ girisler: ['src/lib/readings.ts'], onEk: 'st-sayac-' });
//   const { createReading } = await ice('lib/readings');
//
// Çıktı düzeni src'yi yansıtır: src/lib/x.ts → <dizin>/lib/x.js
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, statSync, readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, relative, resolve, isAbsolute, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire, builtinModules } from 'node:module';

export const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(KOK, 'src');
const UZANTILAR = ['.ts', '.tsx', '.js', '.mjs'];
const PRISMA_ISTEMCI = pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href;
const PRISMA_SHIM = `import { PrismaClient } from ${JSON.stringify(PRISMA_ISTEMCI)};\nexport const prisma = new PrismaClient();\n`;

const dosyaMi = (y) => { try { return statSync(y).isFile(); } catch { return false; } };

// Uzantısız bir yolu kaynak dosyaya çözer: x.ts, x.tsx, x/index.ts ...
function kaynakCoz(taban) {
  if (/\.(ts|tsx|js|mjs)$/.test(taban) && dosyaMi(taban)) return taban;
  for (const u of UZANTILAR) if (dosyaMi(taban + u)) return taban + u;
  for (const u of UZANTILAR) if (dosyaMi(join(taban, 'index' + u))) return join(taban, 'index' + u);
  return null;
}

// Bir içe aktarma belirtecinin src'deki kaynağı (yoksa null).
function belirteciCoz(spec, kaynakDizini) {
  if (spec.startsWith('@/')) return kaynakCoz(join(SRC, spec.slice(2)));
  if (spec.startsWith('./') || spec.startsWith('../')) return kaynakCoz(resolve(kaynakDizini, spec));
  return null;
}

// from '…', import('…'), import '…' — üçünü de yakalar.
const BELIRTEC = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"\n]+)\2/g;
// Yalnız tip içe aktarması derlemede silinir; kapanışa girmesin.
const TIP_ICE = /\b(?:import|export)\s+type\s+[^;]*?\bfrom\s*(['"])[^'"\n]+\1/g;

// .ts kaynağı → çıktıdaki .js yolu
const ciktiYolu = (dizin, kaynak) => join(dizin, relative(SRC, kaynak)).replace(/\.tsx?$/, '.js');

const goreli = (kimden, hedef) => {
  let r = relative(dirname(kimden), hedef).split(sep).join('/');
  if (!r.startsWith('.')) r = './' + r;
  return r;
};

/**
 * @param {object} o
 * @param {string[]} o.girisler  KOK'a göre ya da mutlak .ts yolları
 * @param {string}  [o.onEk]     geçici klasör adı öneki
 * @param {Record<string,string>} [o.shimler]  belirteç → modül kodu
 *        ('@/lib/prisma' varsayılan olarak paylaşılan PrismaClient shim'idir)
 */
export function derle({ girisler, onEk = 'st-derle-', shimler = {} }) {
  const dizin = mkdtempSync(join(tmpdir(), onEk));
  const sahte = { '@/lib/prisma': PRISMA_SHIM, ...shimler };

  // Shim dosyaları: <dizin>/_shim/<ad>.js
  const shimYolu = {};
  mkdirSync(join(dizin, '_shim'), { recursive: true });
  for (const [spec, kod] of Object.entries(sahte)) {
    const y = join(dizin, '_shim', spec.replace(/^@\/(lib\/)?/, '').replace(/[^\w.-]+/g, '_') + '.js');
    writeFileSync(y, kod);
    shimYolu[spec] = y;
  }

  // ── geçişli kapanış ──
  const kapanis = new Set();
  const kuyruk = girisler.map((g) => {
    const y = kaynakCoz(isAbsolute(g) ? g : join(KOK, g));
    if (!y) throw new Error(`derle: giriş bulunamadı: ${g}`);
    return y;
  });
  while (kuyruk.length) {
    const y = kuyruk.pop();
    if (kapanis.has(y)) continue;
    kapanis.add(y);
    const metin = readFileSync(y, 'utf8').replace(TIP_ICE, '');
    for (const [, , , spec] of metin.matchAll(BELIRTEC)) {
      if (spec in sahte) continue;
      const k = belirteciCoz(spec, dirname(y));
      if (k && !kapanis.has(k)) kuyruk.push(k);
    }
  }

  try {
    execFileSync(process.execPath, [
      join(KOK, 'node_modules/typescript/bin/tsc'),
      ...kapanis,
      '--outDir', dizin, '--rootDir', SRC, '--module', 'esnext', '--target', 'es2022',
      '--moduleResolution', 'bundler', '--skipLibCheck', '--allowJs', '--jsx', 'react-jsx',
    ], { stdio: 'pipe' });
  } catch { /* '@/…' yolunu tsc çözemez, hata verir ama JS'i üretir; tip denetimi ayrıca koşuyor */ }

  // ── yolları düzelt ──
  const req = createRequire(join(KOK, 'package.json'));
  for (const kaynak of kapanis) {
    const cikti = ciktiYolu(dizin, kaynak);
    if (!existsSync(cikti)) continue;
    const s = readFileSync(cikti, 'utf8').replace(BELIRTEC, (tam, on, q, spec) => {
      let yeni = null;
      if (spec in shimYolu) yeni = goreli(cikti, shimYolu[spec]);
      else if (spec === '@prisma/client') yeni = PRISMA_ISTEMCI;
      else if (spec.startsWith('@/') || spec.startsWith('.')) {
        const k = belirteciCoz(spec, dirname(kaynak));
        if (k && kapanis.has(k)) yeni = goreli(cikti, ciktiYolu(dizin, k));
      } else if (!spec.startsWith('node:') && !builtinModules.includes(spec) && !/^[a-z]+:/.test(spec)) {
        // Geçici klasörde node_modules yok; paketi projeden çöz.
        try { yeni = pathToFileURL(req.resolve(spec)).href; } catch { /* çözülemiyorsa dokunma */ }
      }
      return yeni ? `${on}${q}${yeni}${q}` : tam;
    });
    writeFileSync(cikti, s);
  }

  // ice('lib/readings') · ice('src/lib/readings.ts') · ice('_shim/prisma')
  const ice = (yol) => {
    let y = yol.replace(/\\/g, '/').replace(/^src\//, '');
    if (!dosyaMi(join(dizin, y))) y = y.replace(/\.(ts|tsx|mjs|js)$/, '') + '.js';
    return import(pathToFileURL(join(dizin, y)).href);
  };
  const temizle = () => rmSync(dizin, { recursive: true, force: true });

  return { dizin, ice, temizle, prismaIstemci: PRISMA_ISTEMCI, prismaShim: shimYolu['@/lib/prisma'] };
}
