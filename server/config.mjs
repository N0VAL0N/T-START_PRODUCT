import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function loadEnv(root) {
  const env = {};
  if (process.env.VERCEL) return { ...process.env };
  for (const name of ['.env', '.env.local']) {
    try {
      const txt = readFileSync(join(root, name), 'utf8');
      for (const line of txt.split('\n')) {
        if (!line.trim() || line.trim().startsWith('#')) continue;
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    } catch { /* нет файла */ }
  }
  return { ...process.env, ...env };
}

export function createConfig(root) {
  const ENV = loadEnv(root);
  return {
    PORT: Number(process.env.PORT || process.env.TSTART_PORT || 8787),
    AI_URL: ENV.DEEPSEEK_API_URL || 'https://api.deepseek.com',
    AI_KEY: ENV.DEEPSEEK_API_KEY,
    MODEL: ENV.DEEPSEEK_MODEL || 'deepseek-chat',
    INVEST_URL: ENV.TINVEST_SANDBOX_URL || 'https://sandbox-invest-public-api.tbank.ru/rest',
    INVEST_TOKEN: ENV.TINVEST_TOKEN,
    APP_NAME: ENV.TINVEST_APP_NAME || 'T-Start',
    CONTRACT: 'tinkoff.public.invest.api.contract.v1',
    INSECURE_TLS: ENV.TSTART_INSECURE_TLS === '1',
    DEPOSIT_DAILY_LIMIT: Number(ENV.SANDBOX_DEPOSIT_DAILY_LIMIT || 5000),
    ENV,
  };
}