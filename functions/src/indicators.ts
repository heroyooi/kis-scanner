export function calcEMA(
  prevEMA: number | undefined,
  price: number,
  period = 5
) {
  const k = 2 / (period + 1);
  return prevEMA == null ? price : (price - prevEMA) * k + prevEMA;
}

export function calcVWAP(
  prevCumPV: number,
  prevCumVol: number,
  typicalPrice: number,
  vol: number
) {
  const cumPV = prevCumPV + typicalPrice * vol;
  const cumVol = prevCumVol + vol;
  const vwap = cumVol ? cumPV / cumVol : typicalPrice;
  return { vwap, cumPV, cumVol };
}

export function candleStrength(
  open: number,
  high: number,
  low: number,
  close: number
) {
  const range = Math.max(1, high - low);
  return (close - open) / range; // 0~1 이상
}
