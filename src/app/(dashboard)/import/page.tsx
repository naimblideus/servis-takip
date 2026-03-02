'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

// ── Tipler ──
interface ImportCounts {
    musteriler: number;
    servisler: number;
    cihazlar: number;
    urunler: number;
    servisurunler: number;
    kasa: number;
    firma: number;
}

interface ImportError {
    row: number;
    table: string;
    error: string;
}

interface ImportSession {
    id: string;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    fileName: string;
    totalRows: ImportCounts;
    importedRows: ImportCounts;
    failedRows: ImportCounts;
    errors: ImportError[];
    startedAt: string;
    completedAt: string | null;
}

type ImportStep = 'upload' | 'processing' | 'result';

// ── Yardımcı: Toplam hesapla ──
function sumCounts(counts: ImportCounts | null): number {
    if (!counts) return 0;
    return Object.values(counts).reduce((a, b) => a + b, 0);
}

// ── Kategori listesi ──
const CATEGORIES = [
    { key: 'firma', label: 'Firma Bilgileri', icon: '🏢' },
    { key: 'urunler', label: 'Ürünler / Parçalar', icon: '📦' },
    { key: 'musteriler', label: 'Müşteriler', icon: '👥' },
    { key: 'cihazlar', label: 'Cihazlar', icon: '🔧' },
    { key: 'servisler', label: 'Servis Kayıtları', icon: '📋' },
    { key: 'servisurunler', label: 'Servis Ürünleri', icon: '🔩' },
    { key: 'kasa', label: 'Kasa Hareketleri', icon: '💰' },
] as const;

export default function ImportPage() {
    const { data: session, status: sessionStatus } = useSession();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<ImportStep>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [importSession, setImportSession] = useState<ImportSession | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showAllErrors, setShowAllErrors] = useState(false);

    const role = (session?.user as any)?.role;
    const sessionLoading = sessionStatus === 'loading';

    // Admin kontrolü
    useEffect(() => {
        if (session && role !== 'ADMIN') {
            router.push('/dashboard');
        }
    }, [session, role, router]);

    // ── Polling: Import ilerlemesini takip et ──
    useEffect(() => {
        if (step !== 'processing' || !importSession?.id) return;

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/import/sql/${importSession.id}`);
                if (res.ok) {
                    const data = await res.json();
                    setImportSession(data);
                    if (data.status === 'COMPLETED' || data.status === 'FAILED') {
                        setStep('result');
                        clearInterval(interval);
                    }
                }
            } catch {
                // Hata varsa tekrar dene
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [step, importSession?.id]);

    // ── Drag & Drop ──
    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files?.[0]) {
            const f = e.dataTransfer.files[0];
            if (f.name.toLowerCase().endsWith('.sql')) {
                setFile(f);
                setError(null);
            } else {
                setError('Sadece .sql uzantılı dosyalar kabul edilir.');
            }
        }
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const f = e.target.files[0];
            if (f.name.toLowerCase().endsWith('.sql')) {
                setFile(f);
                setError(null);
            } else {
                setError('Sadece .sql uzantılı dosyalar kabul edilir.');
            }
        }
    };

    // ── Import başlat ──
    const startImport = async () => {
        if (!file) return;
        setUploading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/import/sql', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'İçe aktarma başlatılamadı');
                setUploading(false);
                return;
            }

            // Import sonucu direkt döndüyse (büyük dosyalar sync işlenir)
            // API sessionId döndürür, biz bunu id olarak normalize ederiz
            const normalized = { id: data.sessionId, ...data };
            if (data.status === 'COMPLETED' || data.status === 'FAILED') {
                setImportSession(normalized);
                setStep('result');
            } else {
                // Polling başlat
                setImportSession(normalized);
                setStep('processing');
            }
        } catch (e: any) {
            setError(e.message || 'Bağlantı hatası');
        } finally {
            setUploading(false);
        }
    };

    // ── Rapor indir ──
    const downloadReport = () => {
        if (!importSession?.id) return;
        window.open(`/api/import/${importSession.id}/report`, '_blank');
    };

    // ── Sıfırla ──
    const resetImport = () => {
        setStep('upload');
        setFile(null);
        setImportSession(null);
        setError(null);
        setShowAllErrors(false);
    };

    // ── İlerleme yüzdesi hesapla ──
    const getProgress = (key: string): { percent: number; imported: number; total: number; status: string } => {
        if (!importSession?.totalRows || !importSession?.importedRows) {
            return { percent: 0, imported: 0, total: 0, status: 'waiting' };
        }
        const total = (importSession.totalRows as any)[key] || 0;
        const imported = (importSession.importedRows as any)[key] || 0;
        const failed = (importSession.failedRows as any)?.[key] || 0;

        if (total === 0) return { percent: 100, imported: 0, total: 0, status: 'skip' };
        const done = imported + failed;
        const percent = Math.round((done / total) * 100);

        if (done >= total) return { percent: 100, imported, total, status: 'done' };
        if (done > 0) return { percent, imported, total, status: 'progress' };
        return { percent: 0, imported: 0, total, status: 'waiting' };
    };

    // ── Genel ilerleme ──
    const getOverallProgress = (): number => {
        if (!importSession?.totalRows) return 0;
        const total = sumCounts(importSession.totalRows);
        if (total === 0) return 0;
        const imported = sumCounts(importSession.importedRows);
        const failed = sumCounts(importSession.failedRows);
        return Math.round(((imported + failed) / total) * 100);
    };

    // ═══════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════

    // Session henüz yükleniyorsa bekle
    if (sessionLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    if (role !== 'ADMIN') {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <p className="text-gray-500">Bu sayfaya erişim yetkiniz yok.</p>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                    <span className="text-3xl">📥</span>
                    Veri İçe Aktarma
                </h1>
                <p className="text-gray-500 mt-1">Eski servis programınızdan SQL yedeği ile veri aktarın</p>
            </div>

            {/* ═══ ADIM 1: DOSYA YÜKLEME ═══ */}
            {step === 'upload' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Desteklenen formatlar */}
                    <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                        <p className="text-sm text-blue-700 font-medium">
                            Desteklenen Formatlar: Pazar Timi, ServisPlus, MySqlBackup, Genel MySQL dump
                        </p>
                    </div>

                    <div className="p-6">
                        {/* Drag & Drop Zone */}
                        <div
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200
                ${dragActive ? 'border-blue-500 bg-blue-50 scale-[1.01]' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}
                ${file ? 'border-green-500 bg-green-50' : ''}
              `}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".sql,.Sql,.SQL"
                                onChange={handleFileSelect}
                                className="hidden"
                            />

                            {file ? (
                                <div>
                                    <div className="text-5xl mb-3">✅</div>
                                    <p className="text-lg font-semibold text-green-700">{file.name}</p>
                                    <p className="text-sm text-green-600 mt-1">
                                        {(file.size / 1024 / 1024).toFixed(2)} MB • Yüklemeye hazır
                                    </p>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                        className="mt-3 text-sm text-red-500 hover:text-red-700 underline"
                                    >
                                        Dosyayı kaldır
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <div className="text-5xl mb-3">📂</div>
                                    <p className="text-lg font-medium text-gray-700">SQL dosyasını buraya sürükleyin</p>
                                    <p className="text-sm text-gray-500 mt-1">veya tıklayarak seçin</p>
                                    <p className="text-xs text-gray-400 mt-3">Max 50MB, .sql uzantılı</p>
                                </div>
                            )}
                        </div>

                        {/* Import edilecek veriler */}
                        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {[
                                { icon: '👥', label: 'Müşteriler' },
                                { icon: '📋', label: 'Servis kayıtları' },
                                { icon: '🔧', label: 'Cihazlar' },
                                { icon: '📦', label: 'Parçalar/Stok' },
                                { icon: '💰', label: 'Kasa hareketleri' },
                                { icon: '🏢', label: 'Firma bilgileri' },
                            ].map((item) => (
                                <div key={item.label} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                                    <span>{item.icon}</span>
                                    <span>{item.label}</span>
                                </div>
                            ))}
                        </div>

                        {/* Uyarılar */}
                        <div className="mt-6 space-y-2">
                            <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-4 py-3">
                                <span className="text-lg mt-[-2px]">⚠️</span>
                                <div>
                                    <p>Mevcut veriler <strong>silinmez</strong>, sadece eklenir.</p>
                                    <p className="mt-1">Aynı müşteri/cihaz varsa <strong>güncellenir</strong> (upsert).</p>
                                </div>
                            </div>
                        </div>

                        {/* Hata mesajı */}
                        {error && (
                            <div className="mt-4 bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
                                <span>❌</span> {error}
                            </div>
                        )}

                        {/* Başlat butonu */}
                        <button
                            onClick={startImport}
                            disabled={!file || uploading}
                            className={`mt-6 w-full py-3 px-4 rounded-xl font-semibold text-white transition-all duration-200
                ${!file || uploading
                                    ? 'bg-gray-300 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transform hover:scale-[1.01]'
                                }
              `}
                        >
                            {uploading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                    Yükleniyor...
                                </span>
                            ) : (
                                '📥 İçe Aktarmayı Başlat'
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* ═══ ADIM 2: CANLI İLERLEME ═══ */}
            {step === 'processing' && importSession && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-yellow-50 to-orange-50 border-b border-yellow-100">
                        <div className="flex items-center gap-3">
                            <svg className="animate-spin h-5 w-5 text-yellow-600" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                            <span className="font-semibold text-yellow-800">İçe Aktarılıyor...</span>
                            <span className="text-sm text-yellow-600 ml-auto">{importSession.fileName}</span>
                        </div>
                    </div>

                    <div className="p-6 space-y-4">
                        {CATEGORIES.map(({ key, label, icon }) => {
                            const p = getProgress(key);
                            return (
                                <div key={key} className="flex items-center gap-4">
                                    <span className="text-xl w-8 text-center">{icon}</span>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-gray-700">{label}</span>
                                            <span className="text-xs text-gray-500">
                                                {p.status === 'done' && '✅ Tamamlandı'}
                                                {p.status === 'progress' && `${p.imported}/${p.total}`}
                                                {p.status === 'waiting' && (p.total > 0 ? 'Bekliyor' : '—')}
                                                {p.status === 'skip' && '—'}
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ease-out ${p.status === 'done' ? 'bg-green-500' :
                                                    p.status === 'progress' ? 'bg-blue-500' :
                                                        'bg-gray-200'
                                                    }`}
                                                style={{ width: `${p.percent}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Genel ilerleme */}
                        <div className="mt-6 pt-4 border-t border-gray-100">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold text-gray-700">Genel İlerleme</span>
                                <span className="text-sm font-bold text-blue-600">{getOverallProgress()}%</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                                    style={{ width: `${getOverallProgress()}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ ADIM 3: SONUÇ RAPORU ═══ */}
            {step === 'result' && importSession && (
                <div className="space-y-6">
                    {/* Başlık */}
                    <div className={`rounded-2xl p-6 ${importSession.status === 'COMPLETED' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                        }`}>
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">
                                {importSession.status === 'COMPLETED' ? '✅' : '❌'}
                            </span>
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">
                                    {importSession.status === 'COMPLETED' ? 'İçe Aktarma Tamamlandı!' : 'İçe Aktarma Başarısız'}
                                </h2>
                                <p className="text-sm text-gray-500 mt-1">
                                    {importSession.fileName}
                                    {importSession.completedAt && ` • ${new Date(importSession.completedAt).toLocaleString('tr-TR')}`}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Sonuç tablosu */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tablo</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Toplam</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Başarılı</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Başarısız</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {CATEGORIES.map(({ key, label, icon }) => {
                                    const total = (importSession.totalRows as any)?.[key] || 0;
                                    const imported = (importSession.importedRows as any)?.[key] || 0;
                                    const failed = (importSession.failedRows as any)?.[key] || 0;
                                    if (total === 0 && imported === 0) return null;
                                    return (
                                        <tr key={key} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-3 text-sm font-medium text-gray-700">
                                                <span className="mr-2">{icon}</span>{label}
                                            </td>
                                            <td className="px-6 py-3 text-center text-sm text-gray-600">{total}</td>
                                            <td className="px-6 py-3 text-center text-sm text-green-600 font-semibold">{imported}</td>
                                            <td className="px-6 py-3 text-center text-sm text-red-600 font-semibold">{failed > 0 ? failed : '—'}</td>
                                        </tr>
                                    );
                                })}
                                {/* Toplam satır */}
                                <tr className="bg-gray-50 font-bold">
                                    <td className="px-6 py-3 text-sm text-gray-800">TOPLAM</td>
                                    <td className="px-6 py-3 text-center text-sm text-gray-800">
                                        {sumCounts(importSession.totalRows)}
                                    </td>
                                    <td className="px-6 py-3 text-center text-sm text-green-700">
                                        {sumCounts(importSession.importedRows)}
                                    </td>
                                    <td className="px-6 py-3 text-center text-sm text-red-700">
                                        {sumCounts(importSession.failedRows) || '—'}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Hatalar */}
                    {importSession.errors && importSession.errors.length > 0 && (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="px-6 py-4 bg-red-50 border-b border-red-100 flex items-center justify-between">
                                <span className="font-semibold text-red-800">
                                    ⚠️ HATALAR ({importSession.errors.length} kayıt)
                                </span>
                                <button
                                    onClick={() => setShowAllErrors(!showAllErrors)}
                                    className="text-sm text-red-600 hover:text-red-800 underline"
                                >
                                    {showAllErrors ? 'Daralt' : 'Tümünü Göster'}
                                </button>
                            </div>
                            <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                                {(showAllErrors ? importSession.errors : importSession.errors.slice(0, 10)).map((err, idx) => (
                                    <div key={idx} className="px-6 py-3 text-sm hover:bg-gray-50">
                                        <span className="text-gray-400 mr-2">#{err.row}</span>
                                        <span className="font-medium text-gray-700 mr-2">{err.table}:</span>
                                        <span className="text-red-600">{err.error}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Aksiyon butonları */}
                    <div className="flex flex-wrap gap-3">
                        {importSession.errors && importSession.errors.length > 0 && (
                            <button
                                onClick={downloadReport}
                                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                            >
                                📥 Hata Raporunu İndir (CSV)
                            </button>
                        )}
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                        >
                            📊 Dashboard&apos;a Git
                        </button>
                        <button
                            onClick={resetImport}
                            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl text-sm font-medium text-white hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm"
                        >
                            🔄 Tekrar Import Et
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
