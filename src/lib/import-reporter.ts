// ═══════════════════════════════════════
// IMPORT REPORTER - Hata raporu oluşturma
// ═══════════════════════════════════════

export interface ImportError {
    row: number;
    table: string;
    error: string;
    rawData?: string;
}

export interface ImportCounts {
    musteriler: number;
    servisler: number;
    cihazlar: number;
    urunler: number;
    servisurunler: number;
    kasa: number;
    firma: number;
}

export interface ImportResult {
    totalRows: ImportCounts;
    importedRows: ImportCounts;
    failedRows: ImportCounts;
    errors: ImportError[];
}

/**
 * Boş import sonucu oluştur
 */
export function createEmptyResult(): ImportResult {
    return {
        totalRows: { musteriler: 0, servisler: 0, cihazlar: 0, urunler: 0, servisurunler: 0, kasa: 0, firma: 0 },
        importedRows: { musteriler: 0, servisler: 0, cihazlar: 0, urunler: 0, servisurunler: 0, kasa: 0, firma: 0 },
        failedRows: { musteriler: 0, servisler: 0, cihazlar: 0, urunler: 0, servisurunler: 0, kasa: 0, firma: 0 },
        errors: [],
    };
}

/**
 * Import sonuçlarından CSV formatında hata raporu oluştur
 * (xlsx bağımlılığı yerine basit CSV - ek paket gerektirmez)
 */
export function generateErrorCSV(result: ImportResult): string {
    const lines: string[] = [];

    // BOM (UTF-8 Türkçe karakter desteği için)
    lines.push('\uFEFF');

    // ── Özet Sayfası ──
    lines.push('=== İÇE AKTARMA RAPORU ===');
    lines.push('');
    lines.push('Tablo,Toplam,Başarılı,Başarısız');
    lines.push(`Müşteriler,${result.totalRows.musteriler},${result.importedRows.musteriler},${result.failedRows.musteriler}`);
    lines.push(`Cihazlar,${result.totalRows.cihazlar},${result.importedRows.cihazlar},${result.failedRows.cihazlar}`);
    lines.push(`Servisler,${result.totalRows.servisler},${result.importedRows.servisler},${result.failedRows.servisler}`);
    lines.push(`Ürünler,${result.totalRows.urunler},${result.importedRows.urunler},${result.failedRows.urunler}`);
    lines.push(`Servis Ürünleri,${result.totalRows.servisurunler},${result.importedRows.servisurunler},${result.failedRows.servisurunler}`);
    lines.push(`Kasa,${result.totalRows.kasa},${result.importedRows.kasa},${result.failedRows.kasa}`);
    lines.push(`Firma,${result.totalRows.firma},${result.importedRows.firma},${result.failedRows.firma}`);
    lines.push('');

    // ── Hatalar ──
    if (result.errors.length > 0) {
        lines.push('=== HATALAR ===');
        lines.push('');
        lines.push('Satır No,Tablo,Hata Mesajı');
        for (const err of result.errors) {
            const safeError = err.error.replace(/"/g, '""').replace(/,/g, ';');
            lines.push(`${err.row},"${err.table}","${safeError}"`);
        }
    }

    return lines.join('\n');
}
