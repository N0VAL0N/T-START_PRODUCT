// src/api/invest/brand.js

export async function fetchBrand(ticker) {
  const res = await fetch(`/api/invest/brand/${ticker}`);
  if (!res.ok) return null;
  return res.json();
}