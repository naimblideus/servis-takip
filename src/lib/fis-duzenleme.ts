// FİŞ HIZLI DÜZENLEME — "Kaydet" sunucuya NEYİ göndermeli?
//
// NEDEN AYRI DOSYA (ölçülmüş para kaybı)
// Düzenleme paneli açılışta fişin değerlerini kopyalıyor, Kaydet'te HEPSİNİ
// geri yazıyordu. Arada fişe parça eklenince (parça paneli toplamı 950 →
// 1.900 yapıyor) panel eski 950'yi tutuyordu; teknisyen yalnız "Yapılan
// İşlem"i düzeltip Kaydet'e basınca toplam sessizce 950'ye dönüyordu. Aynı
// şey ödeme durumu ve fiş tarihi için de geçerliydi (tarih her kayıtta
// saniyesini kaybediyordu).
//
// Kural: yalnız kullanıcının GERÇEKTEN değiştirdiği alan gider. Tutar alanı
// için "değişti mi" sorusu yetmez — tutar arka planda (parçalardan) değişir;
// o yüzden tutar ancak kullanıcı kutuya YAZDIYSA gönderilir.

export interface FisDuzenTamponu {
    assignedUserId: string;
    paymentStatus: string;
    totalCost: string;   // kutudaki metin ("1900.00")
    issueText: string;
    actionText: string;
    notes: string;
    createdAt: string;   // datetime-local metni ("2026-10-14T09:30")
}

/**
 * PATCH /api/tickets/[id] gövdesi: açılıştaki hâle göre değişen alanlar.
 * `toplamElle` — kullanıcı tutar kutusuna yazdı mı. Boş/geçersiz tutar
 * gönderilmez (parseFloat('') = NaN sunucuda kayıt hatası olurdu).
 */
export function fisDuzenGovdesi(
    acilis: FisDuzenTamponu,
    simdi: FisDuzenTamponu,
    toplamElle: boolean,
): Record<string, string> {
    const govde: Record<string, string> = {};
    if (simdi.assignedUserId !== acilis.assignedUserId) govde.assignedUserId = simdi.assignedUserId;
    if (simdi.paymentStatus !== acilis.paymentStatus) govde.paymentStatus = simdi.paymentStatus;
    if (simdi.issueText !== acilis.issueText) govde.issueText = simdi.issueText;
    if (simdi.actionText !== acilis.actionText) govde.actionText = simdi.actionText;
    if (simdi.notes !== acilis.notes) govde.notes = simdi.notes;
    if (simdi.createdAt && simdi.createdAt !== acilis.createdAt) {
        const d = new Date(simdi.createdAt);
        if (!isNaN(d.getTime())) govde.createdAt = d.toISOString();
    }
    if (toplamElle) {
        const n = parseFloat(simdi.totalCost.replace(',', '.'));
        if (simdi.totalCost.trim() !== '' && Number.isFinite(n) && n >= 0) govde.totalCost = n.toFixed(2);
    }
    return govde;
}
