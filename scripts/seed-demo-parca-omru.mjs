/**
 * DEMO — PARÇA ÖMRÜ EKRANI BOŞ GÖRÜNMESİN (lib/parca-omru.ts).
 *
 * seed-bayi-demo.mjs her bayiyi kurduktan sonra TEK satırla çağırır.
 * ⚠️ Buradaki her sayı demo içindir (uydurma), gerçek bayi verisi değildir.
 *
 * Ekranın anlattığı üç hikâye demoda görünmeli:
 *   1. CİHAZ BİLDİRDİ: ağ tarayıcısındaki makineler drum, fırın, bakım kiti
 *      ve atık kutusunun kalan yüzdesini kendisi söylüyor (olcumSarf PARCA).
 *      Biri bir aydır görülmüyor: "eski ölçüm".
 *   2. SAYAÇTAN: kartında ömür yazılı parçalar fişte takıldığı sayaçla
 *      (takilmaSayaci) duruyor; biri birkaç gün, biri birkaç hafta içinde
 *      doluyor, biri sağlıklı. Bir makinede drum İKİ kez değişmiş: eskisi
 *      listede görünmüyor (değişim zinciri). Demonun eski fişlerindeki drumlar
 *      takılma sayacı olmadan duruyor: "yaklaşık".
 *   3. ÖNCELİK: tarayıcıdaki bir makineye fişle de drum takılmış — satır
 *      cihazın kendi yüzdesini gösterir, sayaç hesabı ayrıntıda.
 * Stok ihtiyacı bundan kendiliğinden çıkar (bakım kiti stokta tek).
 */

const GUN = 86_400_000;

/** Son 90 günün okumalarından günlük toplam sayfa — uygulamadaki formülle aynı (ilk ve son okuma). */
async function gunlukHiz(p, tenantId, deviceId, bugun) {
  const okumalar = await p.counterReading.findMany({
    where: { tenantId, deviceId, readingDate: { gte: new Date(bugun.getTime() - 90 * GUN) } },
    orderBy: { readingDate: 'asc' },
    select: { readingDate: true, counterBlack: true, counterColor: true },
  });
  if (okumalar.length < 2) return null;
  const ilk = okumalar[0], son = okumalar[okumalar.length - 1];
  const gun = (son.readingDate.getTime() - ilk.readingDate.getTime()) / GUN;
  const fark = (son.counterBlack + son.counterColor) - (ilk.counterBlack + ilk.counterColor);
  return gun >= 0.5 && fark > 0 ? fark / gun : null;
}

async function guncelSayac(p, tenantId, d) {
  const son = await p.counterReading.findFirst({ where: { tenantId, deviceId: d.id }, orderBy: { readingDate: 'desc' }, select: { counterBlack: true, counterColor: true } });
  const t = son ? son.counterBlack + son.counterColor : (d.counterBlack ?? 0) + (d.counterColor ?? 0);
  return t > 0 ? t : null;
}

export async function parcaOmruDemosu(p, tenantId, bugun = new Date()) {
  const once = (n) => new Date(bugun.getTime() - n * GUN);
  const yonetici = await p.user.findFirst({ where: { tenantId, role: 'ADMIN' }, select: { id: true } });
  if (!yonetici) return;

  // ── KARTLARA ÖMÜR ─────────────────────────────────────────────────────
  // Kutudaki üretici ömrü: Kyocera DK-1150 100.000, Pantum DL-410 12.000.
  const OMURLER = [
    ['Kyocera DK-1150 Drum Ünitesi', 100000],
    ['Pantum DL-410 Drum Ünitesi', 12000],
    ['Canon FM1-A606 Fırın Ünitesi', 300000],
  ];
  const kart = new Map();
  for (const [ad, omur] of OMURLER) {
    const parca = await p.part.findFirst({ where: { tenantId, name: ad }, select: { id: true } });
    if (!parca) continue;
    await p.part.update({ where: { id: parca.id }, data: { omurSayfa: omur } });
    kart.set(ad, { id: parca.id, omur });
  }
  // Bakım kiti: bir tane alındı, o da aşağıda bir makineye takıldı — stokta
  // yok. Stok ihtiyacı "Sipariş et" diyebilsin. Maliyeti alış kaydından
  // (stoktaki her kalem gibi), yoksa stok değeri eksik görünür.
  const kit = await p.part.create({
    data: {
      tenantId, sku: `MK-${tenantId.slice(-6).toUpperCase()}`, name: 'Kyocera MK-1150 Bakım Kiti', group: 'SPARE',
      sellPrice: 3950, buyPrice: 2350, avgCost: 2350, stockQty: 0, minStock: 1, omurSayfa: 100000,
    },
  });
  await p.partPurchase.create({ data: { tenantId, partId: kit.id, quantity: 1, unitCost: 2350, supplier: 'Anadolu Bilgisayar', purchasedAt: once(40), avgAfter: 2350 } });
  kart.set('Kyocera MK-1150 Bakım Kiti', { id: kit.id, omur: 100000 });

  // ── CİHAZ BİLDİRDİ ────────────────────────────────────────────────────
  // Tarayıcıdaki makinelerin sarf tablosuna drumun yanında fırın, bakım kiti
  // ve atık kutusu da eklenir (gerçek yazıcı da hepsini söylüyor).
  const taranan = await p.device.findMany({
    where: { tenantId, olcumAt: { not: null } }, orderBy: { serialNo: 'asc' },
    select: { id: true, brand: true, model: true, olcumSarf: true },
  });
  const EK = [
    [{ ad: 'Fuser Unit', yuzde: 54, tur: 'PARCA' }, { ad: 'Waste Toner Box', yuzde: 9, tur: 'PARCA' }],
    [{ ad: 'Maintenance Kit', yuzde: 14, tur: 'PARCA' }],
    [{ ad: 'Fuser Unit', yuzde: 33, tur: 'PARCA' }],
    [{ ad: 'Maintenance Kit', yuzde: 61, tur: 'PARCA' }, { ad: 'Waste Toner Box', yuzde: 72, tur: 'PARCA' }],
  ];
  for (let i = 0; i < taranan.length && i < EK.length; i++) {
    const kalemler = [...(Array.isArray(taranan[i].olcumSarf) ? taranan[i].olcumSarf : []), ...EK[i]];
    const parca = kalemler.filter((k) => k.tur === 'PARCA').map((k) => k.yuzde);
    await p.device.update({ where: { id: taranan[i].id }, data: { olcumSarf: kalemler, olcumParca: parca.length ? Math.min(...parca) : null } });
  }
  // Bir aydır görülmeyen makine: tarayıcısı kapatılmış müşteri. "Eski ölçüm".
  const sessiz = await p.device.findFirst({ where: { tenantId, olcumAt: null }, orderBy: { serialNo: 'desc' }, select: { id: true } });
  if (sessiz) {
    await p.device.update({
      where: { id: sessiz.id },
      data: {
        olcumAt: once(40), olcumSiyah: 41, olcumParca: 17,
        olcumSarf: [{ ad: 'Black Toner', yuzde: 41, tur: 'TONER' }, { ad: 'Drum Unit', yuzde: 17, tur: 'PARCA' }],
      },
    });
  }

  // ── SAYAÇTAN ──────────────────────────────────────────────────────────
  // Kalan sayfa hedefi makinenin kendi hızından kurulur: "6 gün kaldı"
  // demosu her tazelemede gerçekten 6 gün civarında çıksın.
  let fisNo = 0;
  const takilanlar = new Set();
  const tak = async (d, kartAdi, { kalanGun = null, kalanOran = null, ek = null } = {}) => {
    const k = kart.get(kartAdi);
    if (!k || !d) return false;
    const hiz = await gunlukHiz(p, tenantId, d.id, bugun);
    const simdi = await guncelSayac(p, tenantId, d);
    if (!hiz || !simdi) return false;
    const kalan = kalanGun !== null ? Math.round(hiz * kalanGun) : Math.round(k.omur * kalanOran);
    const kullanilan = Math.max(0, k.omur - kalan);
    const sayac = simdi - kullanilan;
    if (sayac <= 0) return false;
    const tarih = ek?.tarih ?? once(Math.max(1, Math.round(kullanilan / hiz)));
    const fis = await p.serviceTicket.create({
      data: {
        tenantId, deviceId: d.id, customerId: d.customerId, ticketNumber: `PO-${++fisNo}-${tenantId.slice(-4)}`,
        status: 'DELIVERED', priority: 'NORMAL', createdByUserId: yonetici.id, assignedUserId: yonetici.id,
        faultCategory: kartAdi.includes('Bakım') ? 'PERIODIC_MAINTENANCE' : 'CONSUMABLE',
        issueText: `Planlı değişim: ${kartAdi}`, actionText: `${kartAdi} takıldı, test baskısı alındı.`,
        createdAt: tarih, updatedAt: tarih, statusUpdatedAt: tarih,
      },
    });
    await p.ticketPart.create({
      data: { tenantId, ticketId: fis.id, partId: k.id, quantity: 1, unitPrice: 0, takilmaSayaci: ek?.sayac ?? sayac, createdAt: tarih },
    });
    takilanlar.add(d.id);
    return true;
  };

  const cihazlar = await p.device.findMany({
    where: { tenantId }, orderBy: { serialNo: 'asc' },
    select: { id: true, customerId: true, brand: true, model: true, counterBlack: true, counterColor: true, olcumSarf: true },
  });
  const DRUM = /drum/i, KIT = /maintenance|bak[ıi]m/i, FIRIN = /fuser|f[ıi]r[ıi]n/i;
  const bildiriyor = (c, kalip) => (Array.isArray(c.olcumSarf) ? c.olcumSarf : []).some((k) => kalip.test(k?.ad ?? ''));
  // Aday sırası: aynı model → aynı marka → herhangi bir makine (demoda model
  // dağılımı tohuma göre değişiyor; hikâye bir modelin yokluğunda kaybolmasın).
  // O parçayı ZATEN bildiren tarayıcı makinesi aday değil: satırı cihazın
  // olurdu, "sayaçtan" hikâyesi görünmezdi. Sayaç hızı olmayan (susan)
  // makine tak() içinde atlanır, sıradakine geçilir.
  const sec = (marka, model, kalip) => {
    const bos = cihazlar.filter((c) => !takilanlar.has(c.id) && !bildiriyor(c, kalip));
    const birebir = bos.filter((c) => c.brand === marka && c.model === model);
    const markada = bos.filter((c) => c.brand === marka && c.model !== model);
    return [...birebir, ...markada, ...bos.filter((c) => c.brand !== marka)];
  };

  // Birkaç gün içinde dolan drum, birkaç hafta içinde dolan bakım kiti, %4'te Pantum drumu.
  for (const d of sec('Kyocera', 'ECOSYS M2540dn', DRUM)) if (await tak(d, 'Kyocera DK-1150 Drum Ünitesi', { kalanGun: 6 })) break;
  for (const d of sec('Kyocera', 'ECOSYS M2540dn', KIT)) if (await tak(d, 'Kyocera MK-1150 Bakım Kiti', { kalanGun: 21 })) break;
  for (const d of sec('Pantum', 'M7100DW', DRUM)) if (await tak(d, 'Pantum DL-410 Drum Ünitesi', { kalanOran: 0.04 })) break;
  // Sağlıklı fırın: listede yeşil satır da olsun.
  for (const d of sec('Canon', 'iR-ADV C3525i', FIRIN)) if (await tak(d, 'Canon FM1-A606 Fırın Ünitesi', { kalanOran: 0.45 })) break;
  // DEĞİŞİM ZİNCİRİ: aynı makineye drum iki kez. Eski takılış (çoktan dolmuş
  // görünürdü) listede YOK; yenisi %80 civarında.
  for (const d of sec('Kyocera', 'ECOSYS M2540dn', DRUM)) {
    if (!(await tak(d, 'Kyocera DK-1150 Drum Ünitesi', { kalanOran: 0.8 }))) continue;
    const simdi = await guncelSayac(p, tenantId, d);
    await tak(d, 'Kyocera DK-1150 Drum Ünitesi', { kalanOran: 0.8, ek: { tarih: once(700), sayac: Math.max(1, Math.round(simdi * 0.3)) } });
    break;
  }
  // ÖNCELİK: tarayıcıda drumu en düşük görünen makineye fişle de drum
  // takılmış. Sayaç hesabı "%60 kaldı" der, cihaz "%8" — satırda cihazınki
  // görünür, sayaç hesabı ayrıntıda. Sayacı yetmeyen makinede sıradakine geçilir.
  const drumYuzdesi = (d) => Math.min(...(Array.isArray(d.olcumSarf) ? d.olcumSarf : []).filter((k) => /drum/i.test(k.ad ?? '')).map((k) => k.yuzde), 101);
  // Kyocera drum kartı önce Kyocera makinelerde denenir.
  const sira = (d) => (d.brand === 'Kyocera' ? 0 : 1000) + drumYuzdesi(d);
  for (const d of [...taranan].sort((a, b) => sira(a) - sira(b))) {
    const c = cihazlar.find((x) => x.id === d.id);
    if (c && drumYuzdesi(d) <= 100 && (await tak(c, 'Kyocera DK-1150 Drum Ünitesi', { kalanOran: 0.6 }))) break;
  }

  console.log(`  parça ömrü: ${kart.size} kartta ömür · ${Math.min(taranan.length, EK.length)} makine parça bildiriyor · ${fisNo} takılış sayaçla${sessiz ? ' · 1 eski ölçüm' : ''}`);
}
