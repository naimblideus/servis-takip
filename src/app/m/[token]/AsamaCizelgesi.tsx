/**
 * Aşama çizelgesi — müşterinin "işim nerede" sorusunun cevabı.
 *
 * Dikey bir merdiven: geçilen adımlar tarihiyle, şu anki adım vurgulu,
 * kalanlar soluk. Tek bir durum etiketi göstermekten farkı, müşterinin
 * ilerlemeyi GÖRMESİ — "üç gündür serviste" ile "bugün hazır oldu" arasındaki
 * farkı telefon açmadan anlaması.
 */

interface Adim {
  status: string;
  etiket: string;
  tamam: boolean;
  suan: boolean;
  zaman: string | null;
}

export interface Cizelge {
  adimlar: Adim[];
  yanDurum: string | null;
  iptal: { zaman: string | null } | null;
  turetilmis: boolean;
  araAsamalarEksik: boolean;
}

const anZaman = (iso: string) =>
  new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function AsamaCizelgesi({ cizelge }: { cizelge: Cizelge }) {
  if (cizelge.iptal) {
    return (
      <div className="mt-3 rounded-xl bg-slate-50 px-3.5 py-3 text-sm text-slate-500">
        Bu servis kaydı iptal edildi
        {cizelge.iptal.zaman && ` · ${anZaman(cizelge.iptal.zaman)}`}
      </div>
    );
  }

  return (
    <div className="mt-3.5">
      <ol className="relative">
        {cizelge.adimlar.map((a, i) => {
          const sonuncu = i === cizelge.adimlar.length - 1;
          return (
            <li key={a.status} className="relative flex gap-3 pb-4 last:pb-0">
              {/* Dikey çizgi — son adımda çizilmez */}
              {!sonuncu && (
                <span aria-hidden="true"
                  className={`absolute left-[7px] top-4 h-full w-px ${a.tamam ? 'bg-emerald-300' : 'bg-slate-200'}`} />
              )}

              {/* Nokta */}
              <span aria-hidden="true"
                className={`relative z-10 mt-0.5 h-[15px] w-[15px] shrink-0 rounded-full border-2 ${
                  a.suan ? 'border-emerald-600 bg-white ring-4 ring-emerald-100'
                    : a.tamam ? 'border-emerald-500 bg-emerald-500'
                      : 'border-slate-300 bg-white'}`} />

              <div className="min-w-0 flex-1">
                <div className={`text-sm leading-tight ${
                  a.suan ? 'font-semibold text-slate-900'
                    : a.tamam ? 'text-slate-700' : 'text-slate-400'}`}>
                  {a.etiket}
                </div>

                {/* Şu anki adımda yan durum varsa (parça bekleniyor) burada söylenir */}
                {a.suan && cizelge.yanDurum && (
                  <div className="mt-1 inline-flex rounded-full bg-orange-50 px-2.5 py-0.5 text-[11px] font-semibold text-orange-800 ring-1 ring-orange-200">
                    {cizelge.yanDurum}
                  </div>
                )}

                {a.zaman
                  ? <div className="mt-0.5 text-xs text-slate-500">{anZaman(a.zaman)}</div>
                  : a.tamam
                    // Adım tamamlanmış ama geçiş anı kayıtlı değil — uydurma
                    // tarih yazmaktansa boş bırakıyoruz.
                    ? <div className="mt-0.5 text-xs text-slate-400">tarih kayıtlı değil</div>
                    : null}
              </div>
            </li>
          );
        })}
      </ol>

      {cizelge.araAsamalarEksik && (
        <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
          Bu kayıt aşama takibi başlamadan önce açılmış; ara aşamaların saatleri tutulmamış.
        </p>
      )}
    </div>
  );
}
