import { applyGpDelta, gpAmount } from "../../../../morelord-core/scripts/services/currency-service.js";

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
