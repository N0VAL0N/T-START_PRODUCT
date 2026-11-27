import https from 'node:https';
import tls from 'node:tls';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Папка certs/ с корневыми CA (Минцифры и т.п.). В serverless (Vercel) файлы
// кладутся в бандл через vercel.json → functions.includeFiles: "certs/**".
// __dirname нам недоступен напрямую (ESM), поэтому берём от import.meta и
// проверяем несколько вероятных мест: рядом с файлом, в корне функции (/var/task).
function resolveCertsDir(root) {
  const here = fileURLToPath(new URL('.', import.meta.url)); // .../server/
  const candidates = [
    join(root, 'certs'),     // основной путь, вычисленный в index.mjs
    join(here, '..', 'certs'), // рядом с папкой server/
    join(process.cwd(), 'certs'), // cwd функции (Vercel: /var/task)
  ];
  for (const dir of candidates) {
    try {
      if (existsSync(dir) && readdirSync(dir).some(n => /\.(pem|cer|crt)$/i.test(n))) return dir;
    } catch { /* ignore */ }
  }
  return candidates[0];
}

export function createHttpsJson(root, config) {
  const EXTRA_CAS = [];
  const certsDir = resolveCertsDir(root);
  if (existsSync(certsDir)) {
    for (const name of readdirSync(certsDir)) {
      if (/\.(pem|cer|crt)$/i.test(name)) {
        try { EXTRA_CAS.push(readFileSync(join(certsDir, name))); } catch {}
      }
    }
  }
  const SYSTEM_CAS = tls.rootCertificates.map(pem => Buffer.from(pem));
  // Корневые CA из репозитория + системные — так доверие сохраняется и для T-Invest, и для остальных.
  const TRUSTED_CA = EXTRA_CAS.length ? [...SYSTEM_CAS, ...EXTRA_CAS] : undefined;
  if (!TRUSTED_CA && !config.INSECURE_TLS) {
    console.warn(`[tls] CA не найдены в ${certsDir} — проверь, что certs/ попал в бандл (vercel includeFiles).`);
  }

  return function httpsJson(url, { method = 'GET', headers = {}, body } = {}) {
    return new Promise((resolve, reject) => {
      const u = new URL(url);
      const payload = body ? JSON.stringify(body) : undefined;
      const req = https.request({
        hostname: u.hostname,
        port: 443,
        path: u.pathname + u.search,
        method,
        headers: { ...(payload ? { 'Content-Type': 'application/json' } : {}), ...headers },
        rejectUnauthorized: !config.INSECURE_TLS,
        ...(TRUSTED_CA ? { ca: TRUSTED_CA } : {}),
      }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          let json; try { json = data ? JSON.parse(data) : {}; } catch { json = { raw: data }; }
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(json);
          else reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        });
      });
      req.setTimeout(8500, () => req.destroy(new Error('TIMEOUT')));
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  };
}