import https from 'node:https';
import tls from 'node:tls';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function createHttpsJson(root, config) {
  const EXTRA_CAS = [];
  const certsDir = join(root, 'certs');
  if (existsSync(certsDir)) {
    for (const name of readdirSync(certsDir)) {
      if (/\.(pem|cer|crt)$/i.test(name)) {
        try { EXTRA_CAS.push(readFileSync(join(certsDir, name))); } catch {}
      }
    }
  }
  const SYSTEM_CAS = tls.rootCertificates.map(pem => Buffer.from(pem));
  const TRUSTED_CA = EXTRA_CAS.length ? [...EXTRA_CAS, ...SYSTEM_CAS] : undefined;

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