'use strict';
// SaldoPlan 5.3.2 — SGS: períodos por data, fallback limitado a 20 e status por fonte.
const SERIES = {
  selic: { code: 1178, days: 410, ttl: 20 * 60_000, label: 'Selic anualizada' },
  dollar: { code: 1, days: 410, ttl: 20 * 60_000, label: 'Dólar comercial · venda' },
  ipca: { code: 433, days: 610, ttl: 12 * 60 * 60_000, label: 'IPCA mensal' }
};
const store = new Map();
const BCB = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.';
function dateKey(value) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value || ''));
  if (!m) return '';
  const day = Number(m[1]), month = Number(m[2]), year = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day ? `${m[3]}-${m[2]}-${m[1]}` : '';
}
function numeric(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
function normalize(rows) {
  if (!Array.isArray(rows)) throw Error('A série não retornou uma lista');
  const map = new Map();
  for (const row of rows) {
    const date = dateKey(row?.data), value = numeric(row?.valor);
    if (date && value !== null) map.set(date, { date, value });
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}
function compound(rows) {
  if (!Array.isArray(rows) || rows.length < 12) return null;
  const last = [...rows].sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))).slice(-12);
  if (last.some(x => !Number.isFinite(x.value))) return null;
  return (last.reduce((factor, entry) => factor * (1 + entry.value / 100), 1) - 1) * 100;
}
function ptDate(d) { return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`; }
function urls(code, days, now = new Date()) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end.getTime() - days * 86_400_000);
  return [
    `${BCB}${code}/dados?formato=json&dataInicial=${ptDate(start)}&dataFinal=${ptDate(end)}`,
    `${BCB}${code}/dados/ultimos/20?formato=json`
  ];
}
async function requestJson(url, timeout = 9000) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const response = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    const rows = await response.json();
    if (!Array.isArray(rows)) throw Error('Resposta inesperada do SGS');
    const data = normalize(rows);
    if (!data.length) throw Error('Série sem observações válidas');
    return data;
  } finally { clearTimeout(timer); }
}
async function retrieve(key, now = new Date()) {
  const conf = SERIES[key];
  const cached = store.get(key);
  if (cached && now.getTime() - cached.fetchedAt < conf.ttl) return { rows: cached.rows, stale: false, source: cached.source, cached: true };
  const paths = urls(conf.code, conf.days, now);
  let failure;
  for (let i = 0; i < paths.length; i++) {
    try {
      const rows = await requestJson(paths[i]);
      const source = i === 0 ? 'intervalo' : 'últimas 20 observações';
      store.set(key, { rows, fetchedAt: now.getTime(), source });
      return { rows, stale: false, source, cached: false };
    } catch (err) { failure = err; }
  }
  if (cached) return { rows: cached.rows, stale: true, source: cached.source, reason: String(failure?.message || 'Conexão indisponível') };
  throw failure || Error('Nenhuma observação disponível');
}
async function handler(req, res) {
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Método não permitido' });
  }
  const keys = Object.keys(SERIES);
  const results = await Promise.allSettled(keys.map(key => retrieve(key)));
  const history = {}, status = {};
  results.forEach((outcome, index) => {
    const key = keys[index], conf = SERIES[key];
    const good = outcome.status === 'fulfilled' && outcome.value.rows.length > 0;
    const info = good ? outcome.value : null;
    history[key] = info?.rows || [];
    status[key] = {
      ok: good && !info.stale,
      stale: !!info?.stale,
      observations: history[key].length,
      source: `BCB SGS ${conf.code}`,
      period: key === 'ipca' ? 'mensal' : 'diário',
      mode: info?.source || null,
      message: good ? (info.stale ? 'Últimos dados conhecidos; atualização indisponível' : null)
        : `Fonte indisponível: ${String(outcome.reason?.message || 'sem observações').slice(0, 100)}`
    };
  });
  const last = key => history[key].at(-1) || null;
  const indicators = {
    selic: { value: last('selic')?.value ?? null, date: last('selic')?.date ?? null, source: 'BCB SGS 1178 · anualizada' },
    dollar: { value: last('dollar')?.value ?? null, date: last('dollar')?.date ?? null, source: 'BCB SGS 1 · venda' },
    ipca12m: { value: compound(history.ipca), reference: last('ipca')?.date ?? null, source: 'BCB SGS 433 · 12 meses compostos' }
  };
  const any = Object.values(status).some(s => s.ok || s.stale);
  const partial = Object.values(status).some(s => !s.ok) || indicators.ipca12m.value === null;
  res.setHeader('Cache-Control', any ? 'public, s-maxage=300, stale-while-revalidate=300' : 'no-store');
  return res.status(any ? 200 : 503).json({ generatedAt: new Date().toISOString(), indicators, history, status, partial, error: any ? null : 'Indicadores indisponíveis no momento' });
}
module.exports = handler;
module.exports._test = { SERIES, dateKey, numeric, normalize, compound, urls, retrieve, store, requestJson };
