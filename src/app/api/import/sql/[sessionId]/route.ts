// ═══════════════════════════════════════
// GET /api/import/sql/[sessionId]
// Import session durumunu sorgula (polling)
// ═══════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { bayiSuzgeci } from '@/lib/api-auth';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const session = await auth();
        if (!session) {
            return ucHatasi('OTURUM_BULUNAMADI', 401);
        }

        const user = await prisma.user.findFirst({
            where: { email: session.user?.email!, ...bayiSuzgeci(session) },
        });
        if (!user) {
            return ucHatasi('KULLANICI_BULUNAMADI', 404);
        }

        const { sessionId } = await params;
        const importSession = await prisma.importSession.findFirst({
            where: {
                id: sessionId,
                tenantId: user.tenantId,
            },
        });

        if (!importSession) {
            return ucHatasi('IMPORT_OTURUMU_BULUNAMADI', 404);
        }

        return NextResponse.json({
            id: importSession.id,
            status: importSession.status,
            fileName: importSession.fileName,
            totalRows: importSession.totalRows,
            importedRows: importSession.importedRows,
            failedRows: importSession.failedRows,
            errors: importSession.errors,
            startedAt: importSession.startedAt,
            completedAt: importSession.completedAt,
        });
    } catch (e: any) {
        console.error('IMPORT SESSION ERROR:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
