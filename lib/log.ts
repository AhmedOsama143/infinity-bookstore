/**
 * Tiny structured-logging helper. JSON-stringify a fixed shape so Vercel's
 * log search and any downstream pipeline (Datadog, Logflare, etc.) can index
 * by `area`, `event`, and any business-key fields we tack on.
 *
 * Why DIY instead of pino: zero deps, runs in both nodejs and edge runtimes,
 * and we only need three levels. If we ever need rotation / transports,
 * swap to pino — the call sites here use a stable shape so the migration is
 * mechanical.
 *
 * Usage:
 *   import { log } from '@/lib/log';
 *   log.info('fawry/webhook', 'received', { merchantRefNumber, orderStatus });
 *   log.error('fawry/refund', 'fawry_failed', { fawryError });
 *
 * Output line:
 *   {"ts":"2026-05-25T…","level":"info","area":"fawry/webhook","event":"received","merchantRefNumber":"...","orderStatus":"PAID"}
 */

type Level = 'info' | 'warn' | 'error';

type Fields = Record<string, unknown>;

function emit(level: Level, area: string, event: string, fields?: Fields): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    area,
    event,
    ...fields,
  };
  // stdout/stderr split so Vercel's log severity badges colour correctly.
  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    // Logger module — the one place where console.log is the right call.
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

export const log = {
  info: (area: string, event: string, fields?: Fields): void =>
    emit('info', area, event, fields),
  warn: (area: string, event: string, fields?: Fields): void =>
    emit('warn', area, event, fields),
  error: (area: string, event: string, fields?: Fields): void =>
    emit('error', area, event, fields),
};
