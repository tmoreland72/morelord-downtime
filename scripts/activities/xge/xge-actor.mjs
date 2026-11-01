import { applyGpDelta, exhaustionUpdate, gpAmount, payUpTo, paymentNote, readExhaustion } from "./xge-currency.mjs";

export async function spendGp(actor, amount, reason) {
  const name = actor?.name ?? "The character";
  let next;
  try {
    next = applyGpDelta(actor?.system?.currency ?? {}, -Number(amount));
  } catch (error) {
    const have = gpAmount(actor?.system?.currency ?? {});
    throw new Error(`Not enough money. ${reason} costs ${amount} gp and ${name} has ${have} gp.`);
  }
  await actor.update({ "system.currency": next });
  return { currency: next, note: paymentNote(name, { spentGp: Number(amount), reason }) };
}

export async function grantGp(actor, amount, reason) {
  if (!amount) return { currency: actor?.system?.currency ?? {}, note: "" };
  const next = applyGpDelta(actor?.system?.currency ?? {}, Number(amount));
  await actor.update({ "system.currency": next });
  return { currency: next, note: paymentNote(actor?.name ?? "The character", { gainedGp: Number(amount), reason }) };
}

export async function collectDebt(actor, amount, reason) {
  if (!amount) return { unpaid: 0, note: "" };
  const paid = payUpTo(actor?.system?.currency ?? {}, amount);
  await actor.update({ "system.currency": paid.currency });
  const name = actor?.name ?? "The character";
  const note = paid.unpaid
    ? paymentNote(name, { spentGp: paid.paid, unpaidGp: paid.unpaid, reason })
    : paymentNote(name, { spentGp: paid.paid, reason });
  return { unpaid: paid.unpaid, note };
}

export async function clearExhaustion(actor) {
  const previous = readExhaustion(actor);
  await actor.update(exhaustionUpdate(actor));
  return previous;
}
