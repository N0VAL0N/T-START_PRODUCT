// Скрипт проверки интеграций: DeepSeek AI и песочница T-Invest.
// Запуск:  npm run test:integrations
// Читает .env (Vite-переменные) напрямую, без браузера — проверяет ключи и эндпоинты.
// Не входит в прод-бандл, нужен только для ручной проверки на этапе разработки.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Минимальный парсер .env (без зависимостей)
function loadEnv() {
  const env = {};
  for (const name of ['.env', '.env.local']) {
    try {
      const txt = readFileSync(join(root, name), 'utf8');
      for (const line of txt.split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !line.trim().startsWith('#')) {
          env[m[1]] = m[2].replace(/^["']|["']$/g, '');
        }
      }
    } catch {
      /* файла нет — пропускаем */
    }
  }
  return { ...process.env, ...env };
}

const env = loadEnv();

// TLS-проверка ВСЕГДА включена. Если корпоративный прокси подменяет сертификат —
// используйте стандартную NODE_EXTRA_CA_CERTS=/путь/к/ca.pem (проверка при этом сохраняется).
// Глобальное отключение проверки (NODE_TLS_REJECT_UNAUTHORIZED=0) запрещено.

let passed = 0;
let failed = 0;
let skipped = 0;

function ok(name) { passed++; console.log(`  \x1b[32m✔\x1b[0m ${name}`); }
function fail(name, err) { failed++; console.log(`  \x1b[31m✘\x1b[0m ${name}\n     ${err}`); }
function skip(name, why) { skipped++; console.log(`  \x1b[33m○\x1b[0m ${name} — ${why}`); }

// ---------- 1. DeepSeek (OpenAI-совместимый API) ----------
async function testDeepSeek() {
  console.log('\n【DeepSeek AI】');
  const key = env.DEEPSEEK_API_KEY;
  const base = env.DEEPSEEK_API_URL || 'https://api.deepseek.com';
  const model = env.DEEPSEEK_MODEL || 'deepseek-chat';

  if (!key || key.startsWith('your-')) {
    skip('Ключ не задан', 'задай DEEPSEEK_API_KEY=sk-... в .env');
    return;
  }
  if (!key.startsWith('sk-')) {
    skip('Ключ не похож на DeepSeek', 'ключ DeepSeek начинается на sk-');
    return;
  }

  try {
    const t0 = Date.now();
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Ответь одним словом: привет' }],
        max_tokens: 800,
        temperature: 0.2,
        stream: false,
      }),
    });
    const ms = Date.now() - t0;
    if (!res.ok) {
      const body = await res.text();
      fail('Ответ модели', `HTTP ${res.status}: ${body.slice(0, 300)}`);
      return;
    }
    const data = await res.json();
    const msg = data?.choices?.[0]?.message;
    const content = ((msg?.content ?? '').trim() || (msg?.reasoning_content ?? '').trim());
    if (content) ok(`Модель ответила за ${ms} мс: "${content.slice(0, 40)}"`);
    else fail('Пустой ответ', JSON.stringify(data).slice(0, 300));
  } catch (e) {
    fail('Сетевая ошибка', e.message);
  }
}

// ---------- 2. Песочница T-Invest ----------
async function testSandbox() {
  console.log('\n【Песочница T-Invest】');
  const token = env.TINVEST_TOKEN;
  const base = env.TINVEST_SANDBOX_URL || 'https://sandbox-invest-public-api.tbank.ru/rest';
  const appName = env.TINVEST_APP_NAME || 'T-Start';
  const contract = 'tinkoff.public.invest.api.contract.v1';

  if (!token || token.startsWith('your-')) {
    skip('Токен не задан', 'задай TINVEST_TOKEN (токен песочницы)');
    return;
  }

  const call = async (method, body = {}) => {
    const res = await fetch(`${base}/${contract}.${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-app-name': appName,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
    return JSON.parse(text || '{}');
  };

  // 2.1 Открыть счёт
  let accountId;
  try {
    const data = await call('SandboxService/OpenSandboxAccount', {});
    accountId = data.accountId;
    if (accountId) ok(`Счёт песочницы создан: ${accountId.slice(0, 8)}…`);
    else fail('Открытие счёта', 'нет accountId в ответе');
  } catch (e) {
    fail('Открытие счёта', e.message);
    return;
  }

  // 2.2 Пополнить
  try {
    await call('SandboxService/SandboxPayIn', {
      accountId,
      amount: { currency: 'rub', units: '100000', nano: 0 },
    });
    ok('Пополнение 100 000 ₽');
  } catch (e) {
    fail('Пополнение', e.message);
  }

  // 2.3 Поиск инструмента по тикеру
  let instrument;
  try {
    const data = await call('InstrumentsService/ShareBy', {
      idType: 'INSTRUMENT_ID_TYPE_TICKER',
      classCode: 'TQBR',
      id: 'SBER',
    });
    instrument = data?.instrument;
    if (instrument?.uid || instrument?.figi) ok(`Инструмент найден: ${instrument.ticker || 'SBER'} (${(instrument.uid || instrument.figi).slice(0, 8)}…)`);
    else fail('Поиск инструмента', 'инструмент не найден');
  } catch (e) {
    fail('Поиск инструмента', e.message);
  }

  // 2.4 Рыночная покупка
  if (instrument) {
    try {
      const order = await call('SandboxService/PostSandboxOrder', {
        accountId,
        instrumentId: instrument.uid || instrument.figi,
        quantity: '1',
        direction: 'ORDER_DIRECTION_BUY',
        orderType: 'ORDER_TYPE_MARKET',
      });
      ok(`Рыночный ордер BUY SBER размещён (orderId: ${(order.orderId || '').slice(0, 8)}…)`);
    } catch (e) {
      fail('Рыночный ордер', e.message);
    }
  }

  // 2.5 Портфель
  try {
    const p = await call('SandboxService/GetSandboxPortfolio', { accountId, currency: 'rub' });
    const positions = p?.positions?.length ?? 0;
    ok(`Портфель получен, позиций: ${positions}`);
  } catch (e) {
    fail('Портфель', e.message);
  }
}

// ---------- Запуск ----------
console.log('Проверка интеграций T-Start');
await testDeepSeek();
await testSandbox();

console.log(`\nИтого: \x1b[32m${passed} ok\x1b[0m, \x1b[31m${failed} failed\x1b[0m, \x1b[33m${skipped} skipped\x1b[0m`);
process.exit(failed > 0 ? 1 : 0);
