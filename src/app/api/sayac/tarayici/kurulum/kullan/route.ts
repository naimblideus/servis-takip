import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { kurulumKoduNormal } from '@/lib/sayac-tarama';
import { kurulumKoduKullan } from '@/lib/sayac-tarama-veri';
import { kurulumSitesi } from '@/lib/tarayici-kurulum';

export const dynamic = 'force-dynamic';

/**
 * POST { kod, bilgisayar } — önyükleyici (GET /k/KOD) bunu çağırır.
 *
 * Kod BURADA harcanır, GET'te değil: WhatsApp'ın bağlantı önizlemesi ya da
 * tarayıcıda açılan bağlantı kodu yakmasın. Yanıt tarayıcı betiğinin
 * kuruluma özel anahtarla doldurulmuş hâlidir; anahtar bir daha gösterilmez.
 * Hata yanıtı KOD taşır; cümleyi önyükleyici kendi dilinde kurar.
 */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const kod = kurulumKoduNormal(b?.kod);
  if (!kod) return NextResponse.json({ ok: false, kod: 'YOK' }, { status: 404 });
  const bilgisayar = typeof b?.bilgisayar === 'string' ? b.bilgisayar.trim().slice(0, 64) || null : null;
  const r = await kurulumKoduKullan(kod, bilgisayar);
  if (r.durum !== 'TAMAM') return NextResponse.json({ ok: false, kod: r.durum }, { status: r.durum === 'YOK' ? 404 : 410 });
  const sablon = await readFile(join(process.cwd(), 'public', 'tarayici', 'nextus-sayac-tarayici.ps1'), 'utf8');
  const betik = sablon
    // BOM'u önyükleyici dosyaya yazarken kendisi ekliyor.
    .replace(/^\s+/, '')
    .replace("'__SUNUCU__'", `'${kurulumSitesi()}'`)
    .replace("'__ANAHTAR__'", `'${r.anahtar}'`)
    .replace("'__DIL__'", `'${r.dil}'`);
  return NextResponse.json({ ok: true, betik, hedef: r.hedef, topluluk: r.topluluk });
}
