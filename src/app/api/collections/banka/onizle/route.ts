import { NextResponse } from 'next/server';
import { requireAdminUser, authErrorResponse } from '@/lib/api-auth';
import { tabloOku } from '@/lib/tablo-oku';
import { hareketleriCikar, ROLLER, type Kolonlar } from '@/lib/banka-ekstresi';
import { ekstreOnizle } from '@/lib/banka-ekstresi-veri';

// POST — banka ekstresi dosyasını okur, gelen havaleleri müşterilere eşler.
// HİÇBİR ŞEY YAZMAZ: yalnız öneri döner, dosya saklanmaz.
// Hata `kod` ile döner; ekran bayinin dilinde açıklar.
const MAX_BAYT = 5 * 1024 * 1024;
const MAX_HAREKET = 1500;

function kolonlarAyikla(ham: FormDataEntryValue | null): Kolonlar | null {
  if (typeof ham !== 'string' || !ham) return null;
  try {
    const o = JSON.parse(ham);
    const sayi = (v: unknown) => (Number.isInteger(v) && (v as number) >= -1 && (v as number) < 60 ? (v as number) : -1);
    const k = { baslikSatiri: Number.isInteger(o?.baslikSatiri) && o.baslikSatiri >= 0 && o.baslikSatiri < 1000 ? o.baslikSatiri : 0 } as Kolonlar;
    for (const r of ROLLER) k[r] = sayi(o?.[r]);
    return k;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  // MALİ VERİ: yalnız yönetici.
  let tenantId: string;
  try { ({ tenantId } = await requireAdminUser()); } catch (e) { return authErrorResponse(e); }

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ kod: 'DOSYA_YOK' }, { status: 400 }); }
  const dosya = form.get('dosya');
  if (!dosya || typeof dosya === 'string') return NextResponse.json({ kod: 'DOSYA_YOK' }, { status: 400 });
  if (dosya.size > MAX_BAYT) return NextResponse.json({ kod: 'DOSYA_BUYUK' }, { status: 400 });

  const tablo = tabloOku(Buffer.from(await dosya.arrayBuffer()));
  if (!tablo.ok) return NextResponse.json({ kod: tablo.hata }, { status: 400 });

  const elle = kolonlarAyikla(form.get('kolonlar'));
  const okuma = hareketleriCikar(tablo.satirlar, elle);
  // Başlık bulunamadıysa da ilk satırlar dönüyor: bayi kolonları kendisi seçsin.
  const ornek = tablo.satirlar.slice(0, 40).map((s) => s.slice(0, 20));
  if (!okuma.ok) return NextResponse.json({ kod: okuma.hata, ornek }, { status: 400 });
  if (okuma.hareketler.length > MAX_HAREKET) return NextResponse.json({ kod: 'COK_SATIR', n: MAX_HAREKET }, { status: 400 });

  const { satirlar, musteriler } = await ekstreOnizle(tenantId, okuma.hareketler);
  return NextResponse.json({
    bicim: tablo.bicim,
    basliklar: okuma.basliklar,
    kolonlar: okuma.kolonlar,
    ornek,
    giden: okuma.giden,
    okunamayan: okuma.okunamayan,
    satirlar,
    musteriler,
  });
}
