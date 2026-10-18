// DEMO: depolar ve teknisyen araçları (seed-bayi-demo.mjs çağırır).
// Her demo bayisinde teknisyen başına bir araç (en çok 2) ve bir şube deposu;
// araçlara stoktan parça yüklü. Toplam stok değişmez: ana depo = toplam − araçlar.
// Yeniden koşmak güvenli: önce bayinin depoları silinir.
export async function depoDemosunuKur(p, tenantId) {
  await p.depo.deleteMany({ where: { tenantId } });
  const teknisyenler = await p.user.findMany({ where: { tenantId, role: 'TECHNICIAN', isActive: true }, orderBy: { createdAt: 'asc' }, take: 2, select: { id: true, name: true } });
  const parcalar = await p.part.findMany({ where: { tenantId, stockQty: { gte: 4 } }, orderBy: { stockQty: 'desc' }, take: 8, select: { id: true, stockQty: true } });
  if (!parcalar.length) return { depo: 0, satir: 0 };
  const depolar = [];
  const kullanilan = new Set();
  for (const t of teknisyenler) {
    // Aynı adlı iki teknisyen olabilir (depo adı bayide tekil): "Ali aracı 2".
    let ad = `${t.name} aracı`;
    for (let n = 2; kullanilan.has(ad); n++) ad = `${t.name} aracı ${n}`;
    kullanilan.add(ad);
    depolar.push(await p.depo.create({ data: { tenantId, ad, tur: 'ARAC', kullaniciId: t.id } }));
  }
  depolar.push(await p.depo.create({ data: { tenantId, ad: 'Ankara şube deposu', tur: 'DEPO' } }));
  // Her parçanın en çok yarısı araç/depolara dağıtılır; ana depoda da kalsın.
  let satir = 0;
  for (const [i, parca] of parcalar.entries()) {
    let pay = Math.floor(parca.stockQty / 2);
    for (const [j, d] of depolar.entries()) {
      if ((i + j) % 3 === 2) continue; // her depoda her parça yok
      const adet = Math.min(pay, d.tur === 'ARAC' ? 2 + ((i + j) % 2) : 3);
      if (adet <= 0) continue;
      await p.depoStok.create({ data: { tenantId, depoId: d.id, partId: parca.id, adet } });
      pay -= adet; satir++;
    }
  }
  return { depo: depolar.length, satir };
}
