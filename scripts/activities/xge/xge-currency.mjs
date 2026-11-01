const RATES = Object.freeze([
  ["pp", 1000],
  ["gp", 100],
  ["ep", 50],
  ["sp", 10],
  ["cp", 1]
]);

export function totalCp(currency = {}) {
  return RATES.reduce((sum, [key, rate]) => sum + Math.max(0, Math.floor(Number(currency?.[key] ?? 0))) * rate, 0);
}

export function currencyFromCp(cp) {
  let rest = Math.max(0, Math.floor(Number(cp) || 0));
  const result = {};
  for (const [key, rate] of RATES) {
    result[key] = Math.floor(rest / rate);
    rest -= result[key] * rate;
  }
  return result;
}

export function gpAmount(currency) {
  return totalCp(currency) / 100;
}

/** Positive delta pays the character. Negative delta spends. Coin mixes are normalized. */
export function applyGpDelta(currency, deltaGp) {
  const delta = Number(deltaGp);
  if (!Number.isFinite(delta)) throw new Error("The gold amount is not a number.");
  const next = totalCp(currency) + Math.round(delta * 100);
  if (next < 0) {
    const have = gpAmount(currency);
    const need = Math.abs(delta);
    throw new Error(`Not enough money. This costs ${need} gp and the character has ${have} gp.`);
  }
  return currencyFromCp(next);
}

/** Take up to `gp`. Returns the remainder that could not be paid. */
export function payUpTo(currency, gp) {
  const amount = Math.max(0, Number(gp) || 0);
  const have = gpAmount(currency);
  const paid = Math.min(have, amount);
  return { currency: applyGpDelta(currency, -paid), paid, unpaid: amount - paid };
}

export function paymentNote(name, { spentGp = 0, gainedGp = 0, unpaidGp = 0, reason }) {
  const who = name || "The character";
  const parts = [];
  if (spentGp) parts.push(`${who} pays ${spentGp} gp for ${reason}.`);
  if (gainedGp) parts.push(`${who} receives ${gainedGp} gp from ${reason}.`);
  if (unpaidGp) parts.push(`${who} still owes ${unpaidGp} gp for ${reason}.`);
  return parts.join(" ");
}

export function readExhaustion(actor) {
  const raw = actor?.system?.attributes?.exhaustion;
  if (typeof raw === "number") return raw;
  if (raw && typeof raw.value === "number") return Number(raw.value);
  return 0;
}

export function exhaustionUpdate(actor) {
  const raw = actor?.system?.attributes?.exhaustion;
  if (raw && typeof raw === "object") return { "system.attributes.exhaustion.value": 0 };
  return { "system.attributes.exhaustion": 0 };
}
