/**
 * ZAMANLANMIŞ İŞ — dönem başına TEK çalışma.
 *
 * ── SORUN ────────────────────────────────────────────────────────────────
 * Aylık fatura, günlük vade hatırlatması, sayaç hatırlatması yalnız Coolify
 * "Scheduled Tasks" ile tetikleniyordu. Görev kurulmamışsa (ya da CRON_SECRET
 * tanımlı değilse) bu işler canlıda HİÇ çalışmıyordu ve kimse fark etmiyordu.
 * Artık uygulama kendi zamanlayıcısıyla da tetikliyor (lib/zamanlayici.ts).
 *
 * İki tetikleyici aynı ucu çağırabilir: iş başlamadan önce dönemi SAHİPLENİR.
 * Aynı dönemde ikinci çağrı çalışmaz; müşteriye aynı hatırlatma iki kez gitmez.
 *
 * Sahiplenme tek SQL: satır yoksa açılır; varsa ancak dönem değiştiyse devralınır.
 * Yalnız tekrarı ZARARSIZ işler (fatura dönem kilidiyle, demo baştan kurulum)
 * hata ya da yarıda kalma sonrası bir saat bekleyip yeniden denenir. Mesaj
 * gönderen işler dönem başına en fazla bir kez çalışır: yarıda kalan bir
 * gönderimi tekrarlamak, gidenlere ikinci kez göndermek olurdu.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export type DonemTuru = 'gunluk' | 'aylik';

/** Tekrarı zararsız işler: hata sonrası yeniden denenebilir. */
export const TEKRARI_ZARARSIZ: ReadonlySet<string> = new Set(['faturalar', 'demo']);

const iki = (n: number) => String(n).padStart(2, '0');

/** İstanbul saati (UTC+3, 2016'dan beri yaz saati yok). */
export function istanbul(an = new Date()) {
  const d = new Date(an.getTime() + 3 * 3_600_000);
  return { yil: d.getUTCFullYear(), ay: d.getUTCMonth() + 1, gun: d.getUTCDate(), saat: d.getUTCHours(), dakika: d.getUTCMinutes() };
}

export function donemi(tur: DonemTuru, an = new Date()): string {
  const t = istanbul(an);
  return tur === 'aylik' ? `${t.yil}-${iki(t.ay)}` : `${t.yil}-${iki(t.ay)}-${iki(t.gun)}`;
}

/**
 * Dönemi sahiplen. true → bu çağrı çalıştırır. false → bu dönemde çalıştı
 * ya da şu an çalışıyor.
 */
export async function isiSahiplen(anahtar: string, donem: string, kaynak: string): Promise<boolean> {
  const tekrar = TEKRARI_ZARARSIZ.has(anahtar);
  const satir = await prisma.$queryRaw<{ anahtar: string }[]>`
    INSERT INTO "ZamanlanmisIs" ("anahtar", "donem", "basladiAt", "durum", "kaynak")
    VALUES (${anahtar}, ${donem}, NOW(), 'CALISIYOR', ${kaynak})
    ON CONFLICT ("anahtar") DO UPDATE SET
      "donem" = EXCLUDED."donem", "basladiAt" = NOW(), "bittiAt" = NULL,
      "durum" = 'CALISIYOR', "mesaj" = NULL, "kaynak" = EXCLUDED."kaynak"
    WHERE "ZamanlanmisIs"."donem" <> EXCLUDED."donem"
       OR (${tekrar} AND "ZamanlanmisIs"."durum" = 'HATA' AND "ZamanlanmisIs"."basladiAt" < NOW() - INTERVAL '1 hour')
       OR (${tekrar} AND "ZamanlanmisIs"."durum" = 'CALISIYOR' AND "ZamanlanmisIs"."basladiAt" < NOW() - INTERVAL '3 hours')
    RETURNING "anahtar"`;
  return satir.length === 1;
}

export async function isiBitir(anahtar: string, durum: 'TAMAM' | 'HATA', mesaj?: string | null): Promise<void> {
  await prisma.zamanlanmisIs
    .update({ where: { anahtar }, data: { durum, bittiAt: new Date(), mesaj: mesaj ? mesaj.slice(0, 500) : null } })
    .catch(() => {});
}

/**
 * Cron ucunun gövdesini dönem başına bir kez çalıştırır. `?zorla=1` elle
 * yeniden çalıştırmadır: sahiplenme ve kayıt atlanır.
 */
export async function tekSeferlik(
  req: Request,
  anahtar: string,
  tur: DonemTuru,
  is: () => Promise<Response>,
): Promise<Response> {
  if (new URL(req.url).searchParams.get('zorla') === '1') return is();
  const donem = donemi(tur);
  const kaynak = req.headers.get('x-zamanlayici') === '1' ? 'zamanlayici' : 'disari';
  if (!(await isiSahiplen(anahtar, donem, kaynak))) {
    return NextResponse.json({ ok: true, atlandi: true, anahtar, donem });
  }
  try {
    const cevap = await is();
    await isiBitir(anahtar, cevap.ok ? 'TAMAM' : 'HATA', cevap.ok ? null : `HTTP ${cevap.status}`);
    return cevap;
  } catch (e) {
    await isiBitir(anahtar, 'HATA', e instanceof Error ? e.message : String(e));
    throw e;
  }
}
