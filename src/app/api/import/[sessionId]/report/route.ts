// ═══════════════════════════════════════
// GET /api/import/[sessionId]/report
// Import hata raporunu CSV olarak indir
// ═══════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateErrorCSV, type ImportResult } from '@/lib/import-reporter';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: 'Oturum bulunamadı' }, { status: 401 });
        }

        const user = await prisma.user.findFirst({
            where: { email: session.user?.email! },
        });
        if (!user) {
            return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 });
        }

        const { sessionId } = await params;
        const importSession = await prisma.importSession.findFirst({
            where: {
                id: sessionId,
                tenantId: user.tenantId,
            },
        });

        if (!importSession) {
            return NextResponse.json({ error: 'Import oturumu bulunamadı' }, { status: 404 });
        }

        const importResult: ImportResult = {
            totalRows: (importSession.totalRows as any) || { musteriler: 0, servisler: 0, cihazlar: 0, urunler: 0, servisurunler: 0, kasa: 0, firma: 0 },
            importedRows: (importSession.importedRows as any) || { musteriler: 0, servisler: 0, cihazlar: 0, urunler: 0, servisurunler: 0, kasa: 0, firma: 0 },
            failedRows: (importSession.failedRows as any) || { musteriler: 0, servisler: 0, cihazlar: 0, urunler: 0, servisurunler: 0, kasa: 0, firma: 0 },
            errors: (importSession.errors as any[]) || [],
        };

        const csv = generateErrorCSV(importResult);
        const fileName = `import-raporu-${importSession.id.slice(-8)}.csv`;

        return new NextResponse(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${fileName}"`,
            },
        });
    } catch (e: any) {
        console.error('IMPORT REPORT ERROR:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
