/**
 * TARAYICI KURULUMU — tek komutun metinleri.
 *
 * Teknisyen müşteri bilgisayarında Win+R'ye tek satır yapıştırır:
 *   powershell -c "irm https://nextusservis.com/k/KOD | iex"
 * GET /k/KOD küçük bir önyükleyici döner (aşağıda); o da kodu harcayıp
 * kuruluma özel anahtarlı tarayıcıyı indirir, kullanıcının kendi klasörüne
 * yazar ve kurulum kipinde çalıştırır (tarama + günlük görev). Yönetici
 * izni, dosya taşıma, "bu dosya zararlı olabilir" uyarısı yok.
 */
import { kurulumKoduNormal } from '@/lib/sayac-tarama';

/** Betiğe gömülen ve komutta görünen site adresi (panelin kendi adresi). */
export function kurulumSitesi(): string {
  return (process.env.NEXTAUTH_URL || 'https://nextusservis.com').replace(/\/+$/, '');
}

/** Win+R kutusuna yapıştırılacak tek satır. */
export function kurulumKomutu(site: string, kod: string): string {
  return `powershell -ep bypass -c "irm ${site}/k/${kod} | iex"`;
}

const tirnak = (s: string) => s.replace(/'/g, "''");

/**
 * Önyükleyici. Kod geçersizse bile 200 döner ve yalnız bir cümle yazar:
 * `irm | iex` 4xx'te kırmızı bir .NET hatası basar, teknisyen onu okuyamaz.
 */
export function onyukleyici(
  site: string, kod: string, gecersiz: null | 'YOK' | 'KULLANILDI' | 'SURESI_DOLDU', dil: 'tr' | 'en' | null = null,
): string {
  kod = kurulumKoduNormal(kod) ?? '';
  return `# Nextus Servis — sayaç tarayıcı kurulumu
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }
$TR = ${dil ? (dil === 'tr' ? '$true' : '$false') : "((Get-Culture).Name -like 'tr*')"}
function Yaz([string]$a, [string]$b, [string]$renk = 'Gray') { if ($TR) { Write-Host $a -ForegroundColor $renk } else { Write-Host $b -ForegroundColor $renk } }
$Site = '${tirnak(site)}'
$Kod = '${kod}'
$Hata = '${gecersiz ?? ''}'
function Hata-Yaz([string]$k) {
  switch ($k) {
    'KULLANILDI'   { Yaz 'Bu kurulum kodu daha önce kullanıldı. Panelden (Sayaçlar > Ağ Tarayıcı) yeni kod üretin.' 'This setup code was already used. Create a new code in the panel (Meters > Network scanner > Setup).' 'Yellow' }
    'SURESI_DOLDU' { Yaz 'Bu kurulum kodunun süresi doldu. Panelden yeni kod üretin.' 'This setup code has expired. Create a new code in the panel.' 'Yellow' }
    default        { Yaz 'Kurulum kodu bulunamadı. Kodu panelden kontrol edin.' 'Setup code not found. Check the code in the panel.' 'Yellow' }
  }
}
if ($Hata -or -not $Kod) { Hata-Yaz $Hata; return }
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }
Yaz 'Nextus Servis sayaç tarayıcısı kuruluyor...' 'Installing the Nextus Servis meter scanner...' 'Cyan'
try {
  $govde = [Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -Compress @{ kod = $Kod; bilgisayar = $env:COMPUTERNAME }))
  $c = Invoke-RestMethod -Uri "$Site/api/sayac/tarayici/kurulum/kullan" -Method Post -Body $govde -ContentType 'application/json; charset=utf-8' -UseBasicParsing
} catch {
  $k = $null
  try { $k = ($_.ErrorDetails.Message | ConvertFrom-Json).kod } catch { }
  if ($k) { Hata-Yaz $k } else { Yaz "Sunucuya ulaşılamadı: $($_.Exception.Message)" "Could not reach the server: $($_.Exception.Message)" 'Red'; Yaz 'Bu bilgisayarda internet var mı? Kurumsal ağsa BT ekibinden şu adrese izin isteyin:' 'Is this computer online? On a managed network ask IT to allow:'; Write-Host "  $Site" }
  return
}
$klasor = Join-Path $env:LOCALAPPDATA 'NextusSayacTarayici'
New-Item -ItemType Directory -Force -Path $klasor | Out-Null
$yol = Join-Path $klasor 'nextus-sayac-tarayici.ps1'
# BOM şart: Windows PowerShell 5.1 BOM'suz dosyada Türkçe harfleri bozar.
[IO.File]::WriteAllText($yol, [string]$c.betik, (New-Object Text.UTF8Encoding($true)))
$arg = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $yol, '-Kurulum')
if ($c.hedef) { $arg += @('-Ek', [string]$c.hedef) }
if ($c.topluluk) { $arg += @('-Topluluk', [string]$c.topluluk) }
& powershell.exe @arg
`;
}
