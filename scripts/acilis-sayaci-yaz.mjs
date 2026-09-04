// AÇILIŞ SAYACI ONARIMI — okuma geçmişi olmayan cihazlar için zinciri başlatır.
//
// SORUN: Veri aktarımı cihazın sayacını YALNIZCA cihaz kartına yazıyordu,
// okuma kaydı (CounterReading) üretmiyordu. Sonuç: cihazda "142.000 sayfa"
// yazıyor ama okuma geçmişi boş; ilk gerçek okumada fark hesaplanamıyor ve
// o cihaz faturalanamıyor. Ölçüldü: bir bayide 552 cihazda 69,7 milyon sayfa
// yazılı, counterReading sayısı SIFIR.
//
// BU BETİK: sayacı olan ama HİÇ okuması olmayan cihazlara zincirin başını
// yazar — delta 0 (devredilen sayaç bu ayın kullanımı değildir) ve
// billed:true (faturaya asla girmez). Bundan sonraki ilk gerçek okuma farkı
// doğru hesaplar.
//
// GÜVENLİK: okuması OLAN cihaza dokunmaz. Varsayılan ÖNİZLEME'dir.
//
// Çalıştır:  node scripts/acilis-sayaci-yaz.mjs                 (önizleme)
//            node scripts/acilis-sayaci-yaz.mjs --uygula        (yazar)
//            node scripts/acilis-sayaci-yaz.mjs --uygula --bayi <tenantId>
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
const arg = process.argv.slice(2);
const uygula = arg.includes('--uygula');
const bayiIx = arg.indexOf('--bayi');
const bayiId = bayiIx >= 0 ? arg[bayiIx + 1] : null;

const nf = (n) => Number(n || 0).toLocaleString('tr-TR');

try {
  const tenants = await p.tenant.findMany({
    where: bayiId ? { id: bayiId } : {},
    select: { id: true, name: true },
  });

  let genelCihaz = 0, genelSiyah = 0, genelRenkli = 0;

  for (const t of tenants) {
    // Sayacı olan cihazlar
    const cihazlar = await p.device.findMany({
      where: {
        tenantId: t.id,
        OR: [{ counterBlack: { gt: 0 } }, { counterColor: { gt: 0 } }],
      },
      select: { id: true, serialNo: true, brand: true, model: true, counterBlack: true, counterColor: true },
    });
    if (cihazlar.length === 0) continue;

    // Hangilerinin HİÇ okuması yok — tek sorgu, N+1 yok
    const okumasiOlan = new Set(
      (await p.counterReading.groupBy({
        by: ['deviceId'],
        where: { tenantId: t.id, deviceId: { in: cihazlar.map((c) => c.id) } },
      })).map((x) => x.deviceId),
    );
    const hedef = cihazlar.filter((c) => !okumasiOlan.has(c.id));
    if (hedef.length === 0) continue;

    const siyah = hedef.reduce((a, c) => a + (c.counterBlack || 0), 0);
    const renkli = hedef.reduce((a, c) => a + (c.counterColor || 0), 0);
    genelCihaz += hedef.length; genelSiyah += siyah; genelRenkli += renkli;

    console.log(`\n${(t.name || '').slice(0, 46)}`);
    console.log(`  sayacı olan cihaz : ${cihazlar.length}`);
    console.log(`  okuması OLMAYAN   : ${hedef.length}  ← zincir başlatılacak`);
    console.log(`  devredilen sayaç  : S/B ${nf(siyah)} · Renkli ${nf(renkli)}`);
    console.log(`  örnek: ${hedef.slice(0, 3).map((c) => `${c.serialNo} (${nf(c.counterBlack)})`).join(', ')}`);

    if (uygula) {
      // createMany: tek gidiş-geliş, 552 cihazda 552 sorgu yerine 1
      await p.counterReading.createMany({
        data: hedef.map((c) => ({
          tenantId: t.id, deviceId: c.id,
          counterBlack: c.counterBlack || 0,
          counterColor: c.counterColor || 0,
          deltaBlack: 0, deltaColor: 0,
          calculatedCost: 0,
          billed: true,          // faturaya ASLA girmez
          source: 'TOPLU',
        })),
      });
      console.log(`  ✓ ${hedef.length} açılış okuması yazıldı (delta 0, faturalanmaz)`);
    }
  }

  console.log('\n' + '─'.repeat(60));
  if (genelCihaz === 0) {
    console.log('Zincir başlatılacak cihaz yok — hepsinin okuma geçmişi var.');
  } else {
    console.log(`TOPLAM: ${genelCihaz} cihaz · S/B ${nf(genelSiyah)} · Renkli ${nf(genelRenkli)}`);
    if (!uygula) {
      console.log('\nBu bir ÖNİZLEME. Yazmak için:  node scripts/acilis-sayaci-yaz.mjs --uygula');
    } else {
      console.log('\nBitti. Bu cihazların bundan sonraki ilk okuması farkı doğru hesaplayacak.');
    }
  }
} finally {
  await p.$disconnect();
}
