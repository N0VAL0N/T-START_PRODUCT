// Vercel Serverless Function.
// Переиспользует тот же HTTP-обработчик из server/index.mjs (без переписывания логики).
// Пути сохраняются: /api/* -> vercel.json rewrite -> эта функция.
import { handler } from '../server/index.mjs';

export default async function vercelHandler(req, res) {
  // Vercel Node-runtime даёт req/res, совместимые с node:http.
  return handler(req, res);
}
