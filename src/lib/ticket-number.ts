import { prisma } from '@/lib/prisma';

/**
 * Bayi bazında sıradaki fiş numarası.
 *
 * Rota dosyasından buraya taşındı: portaldan gelen arıza bildirimi onaylanınca
 * da fiş açılıyor ve numaralandırmanın TEK bir yerde olması şart — iki ayrı
 * uygulama er ya da geç aynı numarayı iki fişe verir.
 *
 * TSK- (eski) ve SF- (yeni) ön ekleri birlikte taranır: numara sırası
 * bayinin geçmişiyle sürekli kalsın.
 */
export async function generateTicketNumber(tenantId: string): Promise<string> {
  const allTickets = await prisma.serviceTicket.findMany({
    where: { tenantId },
    select: { ticketNumber: true },
  });

  let maxNum = 0;
  for (const t of allTickets) {
    const match = t.ticketNumber.match(/^(?:TSK|SF)-(\d+)$/);
    if (match) {
      const n = parseInt(match[1]);
      if (n > maxNum) maxNum = n;
    }
  }

  let nextNum = maxNum + 1;
  if (nextNum < 1) nextNum = 1;

  // Çakışma denemesi: numara alınmışsa bir sonrakini dene
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = `SF-${nextNum}`;
    const exists = await prisma.serviceTicket.findFirst({
      where: { tenantId, ticketNumber: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
    nextNum++;
  }

  // Son çare: zaman damgalı benzersiz numara
  return `SF-${Date.now()}`;
}
