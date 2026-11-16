/**
 * SES ÇEKİRDEĞİ — RETELL API İSTEMCİSİ. Alan bilmez; komut metni ve araçlar dışarıdan gelir.
 *
 * Sağlayıcıya özgü her istek bu dosyada; kurallar lib/telefon-ajani.ts'te.
 * Ajan Retell'de yaşar, KURALLAR bizde: komut metni bir sınır listesidir,
 * asıl bekçi araç katmanıdır (fiş açamaz, bilgi sızdıramaz).
 *
 * Komut metni ve araçlar ajanda değil "Retell LLM" kaydında durur
 * (`general_prompt`, `general_tools`); ajan yalnız `llm_id` taşır.
 *
 * ⚠ GERÇEK RETELL HESABIYLA DENENMEDİ. Uçlar ve alan adları Retell'in
 * yayımlanmış API belgesinden (Kasım 2026) alındı; ilk canlı kurulumda
 * doğrulanmalı (bkz. TELEFON-AJANI-DEVIR.md).
 */
import { llmGovdesi, type RetellArac } from './retell-govde';

const API = 'https://api.retellai.com';

async function istek<T>(yol: string, init: RequestInit): Promise<T> {
  const anahtar = process.env.RETELL_API_KEY;
  if (!anahtar) throw new Error('RETELL_API_KEY tanımlı değil');
  const r = await fetch(API + yol, {
    ...init,
    headers: {
      Authorization: `Bearer ${anahtar}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) {
    const govde = await r.text().catch(() => '');
    throw new Error(`Retell ${yol.split('/')[1]} HTTP ${r.status}: ${govde.slice(0, 300)}`);
  }
  const metin = await r.text();
  return (metin ? JSON.parse(metin) : {}) as T;
}

export interface LlmIcerigi {
  prompt: string;
  araclar: RetellArac[];
  acilis: string;
}

interface LlmRef {
  llm_id: string;
}
interface AjanRef {
  agent_id: string;
  response_engine?: { type?: string; llm_id?: string };
}

/** Yeni ajan: önce LLM kaydı, sonra ona bağlı ajan. */
export async function ajanOlustur(p: {
  ad: string;
  sesKimligi: string;
  icerik: LlmIcerigi;
  ayar: Record<string, unknown>;
}): Promise<string> {
  const llm = await istek<LlmRef>('/create-retell-llm', { method: 'POST', body: JSON.stringify(llmGovdesi(p.icerik)) });
  const ajan = await istek<AjanRef>('/create-agent', {
    method: 'POST',
    body: JSON.stringify({
      agent_name: p.ad.slice(0, 80),
      voice_id: p.sesKimligi,
      response_engine: { type: 'retell-llm', llm_id: llm.llm_id },
      ...p.ayar,
    }),
  });
  return ajan.agent_id;
}

/**
 * Var olan ajanı güncelle: komut metni/araçlar LLM kaydına, ayarlar ajana.
 * LLM kimliği ajandan okunur (ayrı sütunda tutulmuyor): ajan panelden başka
 * bir LLM'e bağlanırsa eski kimliğe yazıp "güncelledik" sanmayalım.
 */
export async function ajanGuncelle(agentId: string, p: { icerik: LlmIcerigi; ayar: Record<string, unknown> }): Promise<void> {
  const ajan = await istek<AjanRef>(`/get-agent/${encodeURIComponent(agentId)}`, { method: 'GET' });
  const llmId = ajan.response_engine?.llm_id;
  if (!llmId) throw new Error(`Retell ajanı (${agentId}) bir LLM kaydına bağlı değil`);
  await istek(`/update-retell-llm/${encodeURIComponent(llmId)}`, { method: 'PATCH', body: JSON.stringify(llmGovdesi(p.icerik)) });
  await istek(`/update-agent/${encodeURIComponent(agentId)}`, { method: 'PATCH', body: JSON.stringify(p.ayar) });
}

/**
 * Hattı bağla: varsayılan ajan "yalnız aktarma" ajanıdır; gelen her aramada
 * bizim ucumuz sorulur (`inbound_webhook_url`) ve asıl ajana yalnız bayi
 * ajanı AÇIK tuttuysa geçilir. Uç düşerse arama varsayılanda kalır: bot
 * konuşmaz, hat kapanmaz.
 */
export async function hattiBagla(hatNumarasi: string, p: { aktarmaAgentId: string; webhookUrl: string }): Promise<void> {
  const e164 = `+${hatNumarasi.replace(/[^0-9]/g, '')}`;
  await istek(`/update-phone-number/${encodeURIComponent(e164)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      inbound_agents: [{ agent_id: p.aktarmaAgentId, weight: 1 }],
      inbound_webhook_url: p.webhookUrl,
    }),
  });
}

/** Eski hattın bağını çöz (hat başka bayiye geçerken). */
export async function hattiCoz(hatNumarasi: string): Promise<void> {
  const e164 = `+${hatNumarasi.replace(/[^0-9]/g, '')}`;
  await istek(`/update-phone-number/${encodeURIComponent(e164)}`, {
    method: 'PATCH',
    body: JSON.stringify({ inbound_agents: null, inbound_webhook_url: null }),
  });
}
