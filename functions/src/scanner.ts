export type PresetName = 'conservative' | 'base' | 'aggressive';

type TickDerived = {
  price: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  value: number;
  ema5: number;
  vwap: number;
  pct3m: number;
  volSpike10: number;
  dayHighUpdated: boolean;
  halted: boolean;
  viTriggered: boolean;
};

export function checkHit(preset: PresetName, t: TickDerived) {
  const tags: string[] = [];

  const rules = {
    conservative: {
      minSpike: 6.0,
      minValue: 1_000_000_000,
      minPct3m: 2.0,
      needVWAP: true,
      needEMA5: true,
    },
    base: {
      minSpike: 3.0,
      minValue: 500_000_000,
      minPct3m: 1.0,
      needVWAP: true,
      needEMA5: false,
    },
    aggressive: {
      minSpike: 1.5,
      minValue: 100_000_000,
      minPct3m: 0.5,
      needVWAP: false,
      needEMA5: true,
    },
  }[preset];

  if (t.halted || t.viTriggered) return { hit: false, tags: [] as string[] };

  if (t.volSpike10 >= rules.minSpike)
    tags.push(`VOL×${t.volSpike10.toFixed(1)}`);
  if (t.value >= rules.minValue)
    tags.push(`₩${Math.round(t.value / 1e8) / 10}억/분`);
  if (t.pct3m >= rules.minPct3m) tags.push(`+${t.pct3m.toFixed(1)}%(3m)`);

  if (rules.needVWAP && t.price >= t.vwap) tags.push('≥VWAP');
  if (rules.needEMA5 && t.price >= t.ema5) tags.push('≥EMA5');
  if (t.dayHighUpdated) tags.push('HOD Break');

  const passed =
    t.volSpike10 >= rules.minSpike &&
    t.value >= rules.minValue &&
    t.pct3m >= rules.minPct3m &&
    (!rules.needVWAP || t.price >= t.vwap) &&
    (!rules.needEMA5 || t.price >= t.ema5);

  return { hit: passed, tags };
}
