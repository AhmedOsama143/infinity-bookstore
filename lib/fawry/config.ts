/**
 * Fawry environment configuration.
 *
 * Server-side only. `getFawryConfig()` throws if a required variable is
 * missing — fail loud at boot rather than silently sign with `undefined`,
 * which produces no useful error from Fawry's side.
 */

const STAGING_BASE = 'https://atfawry.fawrystaging.com';
const PRODUCTION_BASE = 'https://www.atfawry.com';

const STAGING_PLUGIN_JS =
  'https://atfawry.fawrystaging.com/atfawry/plugin/assets/payments/js/fawrypay-payments.js';
const PRODUCTION_PLUGIN_JS =
  'https://atfawry.com/atfawry/plugin/assets/payments/js/fawrypay-payments.js';
// CSS must track the same host as the JS per environment — loading the staging
// stylesheet in production risks version skew / availability of a host we don't
// control. (Confirm both plugin URLs against Fawry's production docs once the
// dashboard is provisioned; the host can differ from the API base.)
const STAGING_PLUGIN_CSS =
  'https://atfawry.fawrystaging.com/atfawry/plugin/assets/payments/css/fawrypay-payments.css';
const PRODUCTION_PLUGIN_CSS =
  'https://atfawry.com/atfawry/plugin/assets/payments/css/fawrypay-payments.css';

export type FawryEnv = 'staging' | 'production';

export interface FawryConfig {
  env: FawryEnv;
  baseUrl: string;
  pluginJsUrl: string;
  pluginCssUrl: string;
  merchantCode: string;
  /** SECRET. Never log, never expose to the browser. */
  secureKey: string;
  /**
   * Optional. When unset, the charge action falls back to
   * `${origin}/checkout/result`. Only set this to pin an absolute return URL
   * (e.g. a custom domain that differs from the request host).
   */
  returnUrl: string | null;
  webhookUrl: string | null;
}

function readEnv(name: string, required: true): string;
function readEnv(name: string, required: false): string | null;
function readEnv(name: string, required: boolean): string | null {
  const raw = process.env[name];
  // Strip whitespace defensively — a trailing newline from a copy-paste is a
  // classic source of every-request-fails-no-error in Fawry integrations.
  const v = raw?.trim() ?? '';
  if (!v) {
    if (required) {
      throw new Error(`Missing required env var: ${name}`);
    }
    return null;
  }
  return v;
}

export function getFawryConfig(): FawryConfig {
  const env = (readEnv('FAWRY_ENV', false) ?? 'staging') as FawryEnv;
  if (env !== 'staging' && env !== 'production') {
    throw new Error(`FAWRY_ENV must be "staging" or "production", got "${env}"`);
  }

  return {
    env,
    baseUrl: env === 'production' ? PRODUCTION_BASE : STAGING_BASE,
    pluginJsUrl: env === 'production' ? PRODUCTION_PLUGIN_JS : STAGING_PLUGIN_JS,
    pluginCssUrl: env === 'production' ? PRODUCTION_PLUGIN_CSS : STAGING_PLUGIN_CSS,
    merchantCode: readEnv('FAWRY_MERCHANT_CODE', true),
    secureKey: readEnv('FAWRY_SECURE_KEY', true),
    // Optional — the charge action defaults to `${origin}/checkout/result`.
    // Documented as optional in .env.example; making it required here was a
    // latent blocker that failed every charge with "gateway not configured".
    returnUrl: readEnv('FAWRY_RETURN_URL', false),
    webhookUrl: readEnv('FAWRY_WEBHOOK_URL', false),
  };
}

/**
 * Public-safe view of the config (no secret key). Safe to expose to client
 * components if they ever need to know which Fawry environment they're in.
 */
export interface PublicFawryConfig {
  env: FawryEnv;
  pluginJsUrl: string;
  pluginCssUrl: string;
}

export function getPublicFawryConfig(): PublicFawryConfig {
  // Intentionally does NOT call getFawryConfig() — we don't want a missing
  // FAWRY_SECURE_KEY to crash the checkout page during local-dev bootstrap.
  // Only the env name is required to pick the right plugin URL.
  const env = (readEnv('FAWRY_ENV', false) ?? 'staging') as FawryEnv;
  if (env !== 'staging' && env !== 'production') {
    throw new Error(`FAWRY_ENV must be "staging" or "production", got "${env}"`);
  }
  return {
    env,
    pluginJsUrl: env === 'production' ? PRODUCTION_PLUGIN_JS : STAGING_PLUGIN_JS,
    pluginCssUrl: env === 'production' ? PRODUCTION_PLUGIN_CSS : STAGING_PLUGIN_CSS,
  };
}
