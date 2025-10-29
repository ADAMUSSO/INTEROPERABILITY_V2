// src/snowbridge/utils.ts
export function isHexAddress(v: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(v);
}
export function isSs58(v: string) {
  return typeof v === 'string' && v.length >= 5; // minimal basic check
}

/** Safe human -> base units */
export function toBaseUnits(human: string, decimals: number): bigint {
  const s = human.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) {
    throw new Error('Zadaj kladné číslo, napr. 1 alebo 0.5');
  }
  const [intPart, fracPartRaw = ''] = s.split('.');
  if (fracPartRaw.length > decimals) {
    throw new Error(`Maximálne ${decimals} desatinných miest pre tento token.`);
  }
  const fracPart = fracPartRaw.padEnd(decimals, '0');
  const combined = (intPart + fracPart).replace(/^0+/, '') || '0';
  return BigInt(combined);
}
