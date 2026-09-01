/**
 * Logo Muhasebe Entegrasyon Motoru
 * Desteklenen yöntemler: REST API, Dosya (XML), Veritabanı (MSSQL)
 */

export interface LogoConfig {
    method: 'rest' | 'file' | 'db';
    // REST
    apiUrl?: string;
    apiKey?: string;
    firmaKodu?: string;
    donemKodu?: string;
    // DB
    dbServer?: string;
    dbPort?: string;
    dbName?: string;
    dbUser?: string;
    dbPass?: string;
    // Muhasebe eşleştirmeler
    defaultCariGrup?: string;
    defaultGelirHesap?: string;
    kasaHesap?: string;
    bankaHesap?: string;
}

export interface LogoResult {
    success: boolean;
    logoKod?: string;
    error?: string;
}

export interface LogoSyncReport {
    total: number;
    success: number;
    failed: number;
    errors: { entityId: string; error: string }[];
}

// ────────────────────────────────────────────
// Logo REST API Adapter
// ────────────────────────────────────────────

class LogoRestApiAdapter {
    constructor(private config: LogoConfig) { }

    async testConnection(): Promise<boolean> {
        try {
            const res = await fetch(`${this.config.apiUrl}/ping`, {
                headers: { Authorization: `Bearer ${this.config.apiKey}` },
                signal: AbortSignal.timeout(5000),
            });
            return res.ok;
        } catch {
            return false;
        }
    }

    async createOrUpdateCari(customer: { id: string; name: string; phone: string; taxNo?: string; address?: string }): Promise<LogoResult> {
        try {
            const payload = {
                CODE: `C-${customer.id.slice(-8).toUpperCase()}`,
                DEFINITION_: customer.name,
                PHONE1: customer.phone,
                TAXNR: customer.taxNo || '',
                ADDR1: customer.address || '',
                GROUPCODE: this.config.defaultCariGrup || 'MUS',
            };

            const res = await fetch(`${this.config.apiUrl}/ARPs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.apiKey}` },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(15000),
            });

            if (!res.ok) {
                const err = await res.text();
                return { success: false, error: err };
            }

            const data = await res.json();
            return { success: true, logoKod: payload.CODE };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    async createInvoice(ticket: {
        id: string; ticketNumber: string; totalCost: number;
        customer: { name: string; phone: string; taxNo?: string };
        createdAt: Date;
    }): Promise<LogoResult> {
        try {
            const payload = {
                TYPE: 8, // Satış faturası
                NUMBER: ticket.ticketNumber,
                DATE: new Date(ticket.createdAt).toISOString().split('T')[0].replace(/-/g, ''),
                CLIENTREF: `C-${ticket.id.slice(-8).toUpperCase()}`,
                LINES: [{
                    STOCKREF: this.config.defaultGelirHesap || '600',
                    DEFINITION_: `Servis - ${ticket.ticketNumber}`,
                    QUANTITY: 1,
                    PRICE: ticket.totalCost,
                }],
            };

            const res = await fetch(`${this.config.apiUrl}/invoices`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.apiKey}` },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(15000),
            });

            if (!res.ok) return { success: false, error: await res.text() };
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    async createPayment(payment: { id: string; amount: number; method: string; paymentDate: Date }): Promise<LogoResult> {
        try {
            const accountCode = payment.method === 'CARD' || payment.method === 'TRANSFER'
                ? (this.config.bankaHesap || '102')
                : (this.config.kasaHesap || '100');

            const payload = {
                TYPE: 1, // Kasa/Banka tahsilat
                DATE: new Date(payment.paymentDate).toISOString().split('T')[0].replace(/-/g, ''),
                AMOUNT: payment.amount,
                ACCOUNTCODE: accountCode,
            };

            const res = await fetch(`${this.config.apiUrl}/receipts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.apiKey}` },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(15000),
            });

            if (!res.ok) return { success: false, error: await res.text() };
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }
}

// ────────────────────────────────────────────
// Logo XML Dosya Adapter
// ────────────────────────────────────────────

class LogoFileAdapter {
    constructor(private config: LogoConfig) { }

    async testConnection(): Promise<boolean> {
        return true; // Dosya yönteminde bağlantı testi yok
    }

    generateCariXml(customers: { name: string; phone: string; taxNo?: string; address?: string }[]): string {
        const rows = customers.map((c, i) => `
  <Cari>
    <Kod>C-${String(i + 1).padStart(5, '0')}</Kod>
    <Unvan>${escapeXml(c.name)}</Unvan>
    <Telefon>${c.phone || ''}</Telefon>
    <VergiNo>${c.taxNo || ''}</VergiNo>
    <Adres>${escapeXml(c.address || '')}</Adres>
  </Cari>`).join('\n');

        return `<?xml version="1.0" encoding="UTF-8"?>
<CariListesi>
${rows}
</CariListesi>`;
    }

    generateInvoiceXml(ticket: { ticketNumber: string; totalCost: number; createdAt: Date }): string {
        return `<?xml version="1.0" encoding="UTF-8"?>
<Fatura>
  <No>${ticket.ticketNumber}</No>
  <Tarih>${new Date(ticket.createdAt).toLocaleDateString('tr-TR')}</Tarih>
  <Tutar>${ticket.totalCost.toFixed(2)}</Tutar>
</Fatura>`;
    }
}

function escapeXml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ────────────────────────────────────────────
// Ana Entegrasyon Sınıfı
// ────────────────────────────────────────────

export class LogoIntegration {
    private adapter: LogoRestApiAdapter | LogoFileAdapter;

    constructor(private config: LogoConfig) {
        // 'db' (MSSQL) yöntemi UYGULANMADI. Eskiden buradaki koşul yalnız
        // 'file'ı ayırıyordu, yani 'db' seçen bayi sessizce REST adaptörüne
        // düşüyordu — apiUrl tanımsız olduğu için anlamsız hatalar alıyor ve
        // sebebini bulamıyordu. Artık uygulanmamış yöntem uygulanmamış gibi
        // davranıyor: dosya adaptörüne düşer ve her işlemde açıkça reddeder.
        this.adapter = config.method === 'rest'
            ? new LogoRestApiAdapter(config)
            : new LogoFileAdapter(config);
    }

    async testConnection(): Promise<boolean> {
        // Uygulanmamış yöntemde bağlantı testi BAŞARILI DÖNEMEZ. Eskiden
        // dosya yönteminde koşulsuz true dönüyordu; bayi "bağlantı tamam"
        // görüp aktarımın çalıştığını sanıyordu.
        if (!(this.adapter instanceof LogoRestApiAdapter)) return false;
        return this.adapter.testConnection();
    }

    /**
     * UYGULANMAMIŞ YÖNTEM SESSİZCE "BAŞARILI" DÖNMEZ.
     *
     * Eskiden REST dışındaki yöntemlerde aşağıdaki üç fonksiyon
     * `{success:true}` dönüyordu. Sonuç: bayi "100 fatura Logo'ya aktarıldı"
     * yazısını görüyor, Logo'da hiçbir şey olmuyordu. Fatura aktarımında
     * sessiz başarı, sessiz para kaybıdır — ay sonunda bayi mutabakat yapamaz
     * ve sebebini de bulamaz.
     *
     * XML üreticileri (generateCariXml / generateInvoiceXml) yazılmış durumda
     * ama üretilen dosyayı kullanıcıya TESLİM eden bir yol yok. O yol bitene
     * kadar yöntem "hazır" sayılmaz ve hazırmış gibi davranmaz.
     */
    private uygulanmadi(ne: string): LogoResult {
        const yontem = this.config.method === 'file' ? 'XML dosya' : 'veritabanı (MSSQL)';
        return {
            success: false,
            error: `Logo ${yontem} yöntemi henüz uygulanmadı — ${ne} aktarılmadı. REST API yöntemini kullanın.`,
        };
    }

    async createOrUpdateCustomer(customer: any): Promise<LogoResult> {
        if (this.adapter instanceof LogoRestApiAdapter) {
            return this.adapter.createOrUpdateCari(customer);
        }
        return this.uygulanmadi('cari');
    }

    async createInvoice(ticket: any): Promise<LogoResult> {
        if (this.adapter instanceof LogoRestApiAdapter) {
            return this.adapter.createInvoice(ticket);
        }
        return this.uygulanmadi('fatura');
    }

    async createPayment(payment: any): Promise<LogoResult> {
        if (this.adapter instanceof LogoRestApiAdapter) {
            return this.adapter.createPayment(payment);
        }
        return this.uygulanmadi('tahsilat');
    }

    /**
     * Tüm müşterileri Logo'ya gönder
     */
    async syncAllCustomers(customers: any[]): Promise<LogoSyncReport> {
        const report: LogoSyncReport = { total: customers.length, success: 0, failed: 0, errors: [] };
        for (const customer of customers) {
            const result = await this.createOrUpdateCustomer(customer);
            if (result.success) report.success++;
            else { report.failed++; report.errors.push({ entityId: customer.id, error: result.error || 'Bilinmeyen hata' }); }
        }
        return report;
    }

    /**
     * XML cari listesi dosyası oluştur
     */
    generateCariXml(customers: any[]): string {
        if (this.adapter instanceof LogoFileAdapter) {
            return this.adapter.generateCariXml(customers);
        }
        return '';
    }
}

/**
 * Tenant config'inden LogoIntegration oluştur
 */
export function createLogoIntegration(tenant: any): LogoIntegration | null {
    if (!tenant.logoIntegrationEnabled || !tenant.logoIntegrationMethod) return null;

    const config: LogoConfig = {
        method: tenant.logoIntegrationMethod as 'rest' | 'file' | 'db',
        apiUrl: tenant.logoApiUrl,
        apiKey: tenant.logoApiKey,
        firmaKodu: tenant.logoFirmaKodu,
        donemKodu: tenant.logoDönemKodu,
        dbServer: tenant.logoDbServer,
        dbPort: tenant.logoDbPort,
        dbName: tenant.logoDbName,
        dbUser: tenant.logoDbUser,
        defaultCariGrup: tenant.logoDefaultCariGrup,
        defaultGelirHesap: tenant.logoDefaultGelirHesap,
        kasaHesap: tenant.logoKasaHesap,
        bankaHesap: tenant.logoBankaHesap,
    };

    return new LogoIntegration(config);
}
