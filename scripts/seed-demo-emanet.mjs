/**
 * DEMO — MÜŞTERİDE DURAN TONER (emanet defteri). seed-bayi-demo.mjs her
 * demo bayisini kurduktan sonra tek satırla çağırır.
 *
 * ⚠️ Uydurma veri; yalnız demo bayisinin kendi müşterilerine yazılır.
 *
 * EKRANDA ANLATILAN DÖRT HİKÂYE:
 *   1. Büyük müşteri: iki toner türünden yedek bırakıldı; makineler fişle
 *      toner değiştikçe defter KENDİLİĞİNDEN düştü (TAKILDI satırları
 *      gerçek toner değişimlerine bağlı, tonerChangeId ile), sonra yeniden
 *      dolduruldu ve geçen haftaki sayımda 1 toner EKSİK çıktı.
 *   2. Uzun süredir duran: makinesi gitmiş bir modelin 5 toneri 130 gündür
 *      rafta, hiç takılmadı — "iade al" denecek para.
 *   3. İade ve kayıp: biri makine değişince geri alındı, biri kayıp yazıldı.
 *   4. Kaçan toner müşterisine yedek: tarayıcının "başka yerden aldı"
 *      dediği müşteriye kaçaklardan SONRA yedek bırakıldı (kaçan toner
 *      örneği kaybolmasın diye kaçak tarihlerinden sonraya konur).
 *
 * Stok DÜŞÜLMEZ: demo stoğu bugünün fotoğrafı (seed-bayi-demo stok
 * denkleştirmesi); bu bırakışlar geçmişte stoktan çıkmış ve stok o günden
 * beri yenilenmiş sayılır. Kurallar uygulamayla aynı: bakiye eksiye inmez,
 * tüketim yalnız rafta varken ve yalnız aynı tonerden düşer.
 */
const GUN = 86_400_000;

export async function emanetDemosunuKur(p, tenantId, simdi = new Date()) {
  // YALNIZ DEMO BAYİSİ: defteri baştan kurar (yeniden çalıştırınca çift satır olmasın).
  // Gerçek bir bayide çağrılırsa defteri silmek yerine durur.
  const bayi = await p.tenant.findUnique({ where: { id: tenantId }, select: { demo: true } });
  if (!bayi?.demo) throw new Error('emanet demosu yalnız demo bayisine kurulur');
  await p.emanetHareketi.deleteMany({ where: { tenantId } });
  const gunOnce = (n) => new Date(simdi.getTime() - n * GUN);
  const musteriler = await p.customer.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' }, select: { id: true } });
  if (musteriler.length < 5) return { satir: 0 };
  const teknisyen = await p.user.findFirst({ where: { tenantId, role: 'TECHNICIAN' }, orderBy: { createdAt: 'asc' }, select: { id: true } });
  const parcalar = await p.part.findMany({ where: { tenantId }, select: { id: true, name: true, group: true, avgCost: true, buyPrice: true } });
  const kart = new Map(parcalar.map((x) => [x.id, x]));
  const maliyet = (x) => (Number(x?.avgCost ?? 0) > 0 ? Number(x.avgCost) : Number(x?.buyPrice ?? 0) > 0 ? Number(x.buyPrice) : null);
  let satir = 0;

  /** Müşterinin makinelerine fişle takılmış (S/B) tonerler: en çok takılan önce. */
  async function musteriTonerleri(customerId) {
    const cihazlar = await p.device.findMany({ where: { tenantId, customerId }, select: { id: true } });
    const degisimler = await p.tonerChange.findMany({
      where: { tenantId, deviceId: { in: cihazlar.map((c) => c.id) }, partId: { not: null }, source: 'FIS' },
      select: { id: true, deviceId: true, partId: true, channel: true, changedAt: true },
      orderBy: { changedAt: 'asc' },
    });
    const say = new Map();
    for (const d of degisimler) if (d.channel === 'BLACK') say.set(d.partId, (say.get(d.partId) ?? 0) + 1);
    const sira = [...say.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
    return { cihazlar, degisimler, sira, cihazOf: (partId) => degisimler.find((d) => d.partId === partId)?.deviceId ?? null };
  }

  /**
   * Olayları tarih sırasıyla deftere yazar. Fişli toner değişimleri de olay:
   * bırakılmış ve rafta duran tonerden −1 düşer (uygulamadaki kural).
   */
  async function yaz(customerId, olaylar, degisimler) {
    const birakilan = new Set(olaylar.filter((o) => o.tur === 'BIRAKILDI').map((o) => o.partId));
    const tum = [
      ...olaylar,
      ...degisimler.filter((d) => birakilan.has(d.partId)).map((d) => ({ tur: 'TAKILDI', an: d.changedAt, partId: d.partId, adet: 1, degisim: d })),
    ].sort((a, b) => a.an.getTime() - b.an.getTime());
    const bakiye = new Map();
    for (const o of tum) {
      const x = kart.get(o.partId);
      if (!x) continue;
      const b0 = bakiye.get(o.partId) ?? 0;
      const ortak = { tenantId, customerId, partId: x.id, parcaAdi: x.name, tarih: o.an, birimMaliyet: maliyet(x) };
      let adet;
      if (o.tur === 'BIRAKILDI') {
        adet = o.adet;
        await p.emanetHareketi.create({ data: { ...ortak, tur: 'BIRAKILDI', adet, bosAdet: o.bos ?? 0, deviceId: o.deviceId ?? null, kullaniciId: teknisyen?.id ?? null, not: o.not ?? null } });
      } else if (o.tur === 'TAKILDI') {
        if (b0 < 1) continue;
        adet = -1;
        await p.emanetHareketi.create({ data: { ...ortak, tur: 'TAKILDI', adet, deviceId: o.degisim.deviceId, tonerChangeId: o.degisim.id } });
      } else {
        const n = Math.min(o.adet, b0);
        if (n < 1) continue;
        adet = -n;
        await p.emanetHareketi.create({ data: { ...ortak, tur: o.tur, adet, kullaniciId: teknisyen?.id ?? null, not: o.not ?? null } });
      }
      bakiye.set(o.partId, b0 + adet);
      satir++;
    }
  }

  // 1) Büyük müşteri: otomatik tüketim + yeniden doldurma + sayım farkı.
  {
    const m = musteriler[1];
    const { degisimler, sira, cihazOf } = await musteriTonerleri(m.id);
    const [x, y] = sira;
    if (x) {
      const ilk = gunOnce(140);
      await yaz(m.id, [
        { tur: 'BIRAKILDI', an: ilk, partId: x, adet: 3, bos: 2, deviceId: cihazOf(x), not: 'Arşiv dolabının üst rafı' },
        ...(y ? [{ tur: 'BIRAKILDI', an: ilk, partId: y, adet: 2 }] : []),
        { tur: 'BIRAKILDI', an: gunOnce(12), partId: x, adet: 2, bos: 1, deviceId: cihazOf(x) },
        { tur: 'SAYIM', an: gunOnce(3), partId: x, adet: 1, not: 'Rafta 1 eksik — muhasebeye soruldu' },
      ], degisimler);
    }
  }

  // 2) Uzun süredir duran: bu müşterinin makinelerine uymayan toner 130 gündür rafta.
  {
    const m = musteriler[2];
    const { degisimler, sira, cihazOf } = await musteriTonerleri(m.id);
    const tonerler = parcalar.filter((x) => x.group === 'TONER' && !sira.includes(x.id));
    const eski = tonerler.find((x) => /TK-1170/.test(x.name)) ?? tonerler[0];
    const olaylar = [];
    if (eski) olaylar.push({ tur: 'BIRAKILDI', an: gunOnce(130), partId: eski.id, adet: 5, not: 'Geri alınan makinenin sözleşmesinden kalan' });
    if (sira[0]) olaylar.push({ tur: 'BIRAKILDI', an: gunOnce(100), partId: sira[0], adet: 2, deviceId: cihazOf(sira[0]) });
    if (olaylar.length) await yaz(m.id, olaylar, degisimler);
  }

  // 3) İade ve kayıp.
  {
    const m = musteriler[4];
    const { degisimler, sira, cihazOf } = await musteriTonerleri(m.id);
    if (sira[0]) {
      await yaz(m.id, [
        { tur: 'BIRAKILDI', an: gunOnce(200), partId: sira[0], adet: 6, deviceId: cihazOf(sira[0]) },
        { tur: 'IADE', an: gunOnce(60), partId: sira[0], adet: 1, not: 'Makine değişti, fazlası geri alındı' },
        { tur: 'KAYIP', an: gunOnce(20), partId: sira[0], adet: 1, not: 'Müşteri bir tanesinin kaybolduğunu bildirdi' },
      ], degisimler);
    }
  }

  // 4) Kaçan toner müşterisine yedek — kaçakların SONRASINA.
  {
    const m = musteriler[0];
    const { degisimler, cihazlar } = await musteriTonerleri(m.id);
    const kacak = await p.tonerChange.findFirst({
      where: { tenantId, deviceId: { in: cihazlar.map((c) => c.id) }, source: 'TARAYICI' },
      orderBy: { changedAt: 'desc' }, select: { deviceId: true, changedAt: true },
    });
    const toner = kacak ? [...degisimler].reverse().find((d) => d.deviceId === kacak.deviceId && d.channel === 'BLACK')?.partId : null;
    const an = kacak ? new Date(Math.max(kacak.changedAt.getTime() + GUN, gunOnce(5).getTime())) : null;
    if (toner && an && an < simdi) {
      await yaz(m.id, [{ tur: 'BIRAKILDI', an, partId: toner, adet: 4, bos: 1, deviceId: kacak.deviceId, not: 'Kaçan toner ekranından: rafa yedek, bundan sonra biz getiriyoruz' }], []);
    }
  }
  return { satir };
}
