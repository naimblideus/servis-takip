import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { yeniPortalJetonu } from '@/lib/portal';
import { hasModule } from '@/lib/modules';
import { writeAudit, istekIp } from '@/lib/audit';

/**
 * TOPLU PORTAL AÇMA.
 *
 * ── NEDEN VAR ─────────────────────────────────────────────────────────
 * Portal erişimi müşteri müşteri açılıyordu. Ölçüldü: Saygılı Fotokopi'nin
 * 305 müşterisi var ve HİÇBİRİNİN erişimi yok. 305 kartı tek tek açmak
 * kimsenin yapmayacağı bir iş, o yüzden hiç yapılmamış.
 *
 * Sonuç: Cihazlarım, toner tükenme tahmini, "kendi yazıcına uyan sarf" ve
 * sahada doğrulanmış uyumluluk — ürünün rakipsiz olduğu her şey — çalışıyor
 * ama kimse ulaşamıyor. Bu uç o kapıyı açıyor.
 *
 * ── ZATEN AÇIK OLANA DOKUNULMAZ ───────────────────────────────────────
 * Toplu işlem YALNIZ `portalEnabled: false` olanları açıyor. Açık olanın
 * jetonunu yenilemek, müşterinin elindeki çalışan bağlantıyı sessizce
 * öldürmek olurdu — ve bunu ancak müşteri "linkim açılmıyor" dediğinde
 * öğrenirdiniz. Yenileme tek tek, bilinçli bir işlem olarak kalıyor.
 *
 * ── TELEFONU OLMAYAN AÇILMAZ ──────────────────────────────────────────
 * Bağlantı gönderilemeyecek bir müşteride portal açmak, veriyi bir
 * bağlantının arkasında yayınlayıp kimseye vermemek demek. Fayda yok,
 * yüzey var.
 */
export async function POST(req: NextRequest) {
  try {
    const { tenantId, user } = await requireTenantUser();

    const firma = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, plan: true, modules: true, isActive: true, isSuspended: true },
    });
    if (!firma || !hasModule(firma, 'PORTAL')) {
      return NextResponse.json({ error: 'Müşteri Paneli paketinizde yok.' }, { status: 403 });
    }

    const govde = await req.json().catch(() => ({}));
    const secilenler: string[] | null = Array.isArray(govde?.musteriIdler)
      ? govde.musteriIdler.filter((x: unknown) => typeof x === 'string')
      : null;

    /**
     * Aday listesi: kapalı + telefonu olan. Seçim gönderildiyse onunla
     * KESİŞTİRİLİYOR — istemciden gelen kimlik listesine güvenip doğrudan
     * güncellemek, başka kiracının müşterisini açmaya açık kapı bırakırdı.
     */
    const adaylar = await prisma.customer.findMany({
      where: {
        tenantId,
        portalEnabled: false,
        // `phone` bu şemada ZORUNLU alan, yani null olamaz — ama boş dize
        // olabilir. Bağlantı gönderilemeyecek müşteride portal açmak, veriyi
        // bir bağlantının arkasında yayınlayıp kimseye vermemek demek.
        phone: { not: '' },
        ...(secilenler ? { id: { in: secilenler } } : {}),
      },
      select: { id: true, name: true, phone: true },
    });

    if (!adaylar.length) {
      return NextResponse.json({ ok: true, acilan: 0, mesaj: 'Açılacak müşteri yok.' });
    }

    /**
     * Jeton MÜŞTERİ BAŞINA üretiliyor — tek jetonu paylaştırmak, bir
     * müşterinin bağlantısıyla başkasının cihazlarının görülmesi demekti.
     *
     * Tek tek `update`: `updateMany` tek bir değer yazar, yani herkese AYNI
     * jetonu verirdi. Burada yavaşlık doğru olanın bedeli.
     */
    let acilan = 0;
    for (const m of adaylar) {
      await prisma.customer.update({
        where: { id: m.id },
        data: { portalEnabled: true, portalToken: yeniPortalJetonu(), portalTokenAt: new Date() },
      });
      acilan++;
    }

    /**
     * DENETİM: portal açmak, müşterinin verisini bir bağlantının arkasında
     * yayınlamaktır. Toplu işlemde 305 ayrı kayıt yerine TEK kayıt + sayı:
     * sorulan soru "kim ne zaman toplu açtı", tek tek hangi müşteri değil.
     */
    await writeAudit({
      tenantId,
      userId: user.id,
      action: 'MUSTERI_PORTALI_TOPLU_ACILDI',
      entityType: 'Customer',
      entityId: tenantId,
      newValue: { acilan, secimle: !!secilenler },
      ipAddress: istekIp(req),
    });

    return NextResponse.json({ ok: true, acilan });
  } catch (e) {
    return authErrorResponse(e);
  }
}
