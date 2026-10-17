/**
 * DEMO: MEMNUNİYET + SAHADA GEÇEN SÜRE + SAYAÇSIZ KAPANMAZ.
 *
 * ⚠️ BURADAKİ HER PUAN VE YORUM UYDURMADIR. Gerçek müşterinin sözü girmez.
 *
 * seed-bayi-demo.mjs demo bayilerini kurduktan sonra tek satırla çağırır:
 *   memnuniyetDemosu(p, [bayiId, ...])
 * Ayrı dosya, çünkü aynı tohuma başka özellikler de kendi satırını ekliyor;
 * hepsi o 1.600 satırlık dosyanın içine yazılsaydı her ekleme çakışırdı.
 *
 * NEDEN DOLU: boş ekran anlatmıyor (seed-bayi-demo başlığına bakın). Her
 * demo bayisinde:
 *   · /memnuniyet tepede +57 ve "10 müşteriden 7'si tavsiye ediyor";
 *     önceki 90 gün +14 → "43 puan yukarıda"; cevap oranı %70.
 *   · "Aranması gerekenler"de iki müşteri (3 ve 5 vermiş, yorumlu).
 *   · Teknisyene göre iki satır: işin bir kısmını patron yapmış.
 *   · Son 90 günün anketli fişlerinde "Vardım / Çıktım" saatleri.
 *   · Sayaçsız kapanmaz AÇIK: demoda Ayarlar kapalı olduğu için açık
 *     gelmezse özellik hiç gösterilemezdi. Kiralık cihazın fişini sayaçsız
 *     "Teslim edildi" yapan ziyaretçi sayaç kutusunu görür.
 *
 * Deterministik: rastgele sayı yok. Aynı demo, aynı hikâye. Tarihler fişin
 * kendi tarihine göre: anket fiş teslim edildikten sonra sorulmuş olur.
 * Tekrar çalışırsa var olan anketin üstüne yazmaz (ticketId tekil).
 */

const GUN = 86_400_000;
const DK = 60_000;

// Son 90 gün: 14 cevap + 6 cevapsız. "P" = işi patron yapmış.
const SON = [
  { puan: 10, kim: 'T', yorum: 'Aynı gün geldiler, sorun yirmi dakikada çözüldü. Teşekkürler.' },
  { puan: 10, kim: 'P' },
  { puan: 9, kim: 'T' },
  { puan: 3, kim: 'T', yorum: 'Teknisyen randevuya iki saat geç geldi, kimse haber vermedi.' },
  { puan: 9, kim: 'P', yorum: 'Makinenin içini de temizleyip gitti, çok ilgiliydi.' },
  { puan: 10, kim: 'T' },
  { puan: 7, kim: 'T' },
  { puan: 10, kim: 'P' },
  { puan: 5, kim: 'T', yorum: 'Toner değişti ama çıktılarda hâlâ çizgi var.' },
  { puan: 9, kim: 'T' },
  { puan: 8, kim: 'P' },
  { puan: 10, kim: 'T', yorum: 'Sayaç okumasını bile kendisi yaptı, bize iş bırakmadı.' },
  { puan: 10, kim: 'P' },
  { puan: 10, kim: 'T' },
  { puan: null }, { puan: null }, { puan: null }, { puan: null }, { puan: null }, { puan: null },
];
// Önceki 90 gün: 7 cevap → +14. Memnun olmayanlar o zaman aranmış.
const ONCEKI = [
  { puan: 9 }, { puan: 6, arandi: true }, { puan: 10 }, { puan: 8 },
  { puan: 4, arandi: true, yorum: 'Parça bir hafta gelmedi, makine bekledi.' }, { puan: 10 }, { puan: 7 },
];

/**
 * @param {import('@prisma/client').PrismaClient} p
 * @param {string[]} bayiIdleri demo bayileri (demo: true olmayan atlanır)
 */
export async function memnuniyetDemosu(p, bayiIdleri) {
  const simdi = Date.now();
  for (const tenantId of bayiIdleri) {
    const bayi = await p.tenant.findUnique({ where: { id: tenantId }, select: { demo: true } });
    // Yalnız demo bayisine yazılır: gerçek bir bayiye uydurma puan düşmesin.
    if (!bayi?.demo) continue;

    await p.tenant.update({ where: { id: tenantId }, data: { sayacZorunlu: true } });

    const patron = await p.user.findFirst({ where: { tenantId, role: 'ADMIN', isActive: true }, orderBy: { createdAt: 'asc' }, select: { id: true } });
    const fisler = (bas, son, adet) => p.serviceTicket.findMany({
      where: { tenantId, deletedAt: null, status: 'DELIVERED', createdAt: { gte: new Date(simdi - son * GUN), lte: new Date(simdi - bas * GUN) } },
      orderBy: { createdAt: 'desc' },
      take: adet,
      select: { id: true, createdAt: true, customerId: true, deviceId: true, assignedUserId: true },
    });
    // Anket teslimden sonra sorulur ve cevap birkaç gün içinde gelir: pencere
    // sınırları cevap tarihini dönemin içinde tutacak kadar içeride.
    const son = await fisler(3, 85, SON.length);
    const onceki = await fisler(97, 175, ONCEKI.length);

    let yazilan = 0, sahada = 0;
    const yaz = async (f, plan, i) => {
      if (await p.memnuniyetAnketi.findUnique({ where: { ticketId: f.id }, select: { id: true } })) return;
      const teknisyenId = plan.kim === 'P' && patron ? patron.id : f.assignedUserId;
      // İşi patron yaptıysa fiş de onda: karne ile pano aynı kişiyi söylesin.
      if (teknisyenId !== f.assignedUserId) {
        await p.serviceTicket.update({ where: { id: f.id }, data: { assignedUserId: teknisyenId } });
      }
      const gonderildiAt = new Date(f.createdAt.getTime() + (90 + (i % 4) * 25) * DK);
      const cevaplandiAt = plan.puan === null ? null : new Date(gonderildiAt.getTime() + ((i * 37) % 600 + 8) * DK);
      await p.memnuniyetAnketi.create({
        data: {
          tenantId, ticketId: f.id, customerId: f.customerId, deviceId: f.deviceId, teknisyenId,
          puan: plan.puan, yorum: plan.yorum ?? null,
          kanal: i % 3 === 0 ? 'WHATSAPP' : 'YERINDE',
          gonderildiAt, cevaplandiAt,
          arandiAt: plan.arandi && cevaplandiAt ? new Date(cevaplandiAt.getTime() + 26 * 60 * DK) : null,
        },
      });
      yazilan++;
    };
    for (let i = 0; i < son.length; i++) {
      await yaz(son[i], SON[i], i);
      // Sahada geçen süre: varış fiş açıldıktan 35–150 dk sonra, 25–95 dk sahada.
      const varisAt = new Date(son[i].createdAt.getTime() + (35 + ((i * 23) % 116)) * DK);
      const ayrilisAt = new Date(varisAt.getTime() + (25 + ((i * 17) % 71)) * DK);
      await p.serviceTicket.update({ where: { id: son[i].id }, data: { varisAt, ayrilisAt } });
      sahada++;
    }
    for (let i = 0; i < onceki.length; i++) await yaz(onceki[i], ONCEKI[i], i);
    console.log(`  memnuniyet: ${yazilan} anket · ${sahada} fişte vardım/çıktım · sayaçsız kapanmaz açık`);
  }
}
