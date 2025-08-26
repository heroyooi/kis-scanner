import { fetchIntradayCandles } from './kisQuote';

export type ScanParams = {
  volumeLookback?: number; // 직전 N개 봉 평균 거래량
  volumeK?: number; // k배 (급증 배수)
  minChangePct?: number; // 당일 등락률 하한 (예: 2%)
};

export type ScanHit = {
  symbol: string;
  name?: string;
  lastPrice: number;
  lastVolume: number;
  avgVolumeN: number;
  volumeMultiple: number;
  changePct: number;
  at: string; // ISO 저장 시각
};

function pct(from: number, to: number) {
  if (!from || !to) return 0;
  return ((to - from) / from) * 100;
}

export async function scanOneSymbol(
  symbol: string,
  params: ScanParams
): Promise<ScanHit | null> {
  const { volumeLookback = 20, volumeK = 3, minChangePct = 2 } = params;

  const candles = await fetchIntradayCandles(symbol);
  if (!candles?.length) return null;

  // 최근 봉 / 직전 N봉 평균
  const last = candles[candles.length - 1];
  const prev = candles.slice(
    Math.max(0, candles.length - 1 - volumeLookback),
    candles.length - 1
  );
  const avgVol = prev.length
    ? prev.reduce((s, r) => s + (r.v || 0), 0) / prev.length
    : 0;

  // 당일 시가(첫 봉 시가) vs 현재가 등락률
  const firstOpen = candles[0]?.o || last.o || 0;
  const change = pct(firstOpen, last.c);

  const volMultiple = avgVol ? last.v / avgVol : 0;

  const passVolume = last.v >= avgVol * volumeK && last.v > 0;
  const passChange = change >= minChangePct;

  if (passVolume && passChange) {
    return {
      symbol,
      lastPrice: last.c,
      lastVolume: last.v,
      avgVolumeN: Math.round(avgVol),
      volumeMultiple: Number(volMultiple.toFixed(2)),
      changePct: Number(change.toFixed(2)),
      at: new Date().toISOString(),
    };
  }
  return null;
}

/** 여러 종목 스캔 */
export async function runScan(symbols: string[], params: ScanParams) {
  const hits: ScanHit[] = [];
  for (const s of symbols) {
    try {
      const hit = await scanOneSymbol(s, params);
      if (hit) hits.push(hit);
    } catch (e) {
      // 개별 종목 실패는 무시하고 진행
      console.error('[scan error]', s, e);
    }
  }
  // 직관적 정렬: 등락률 ↓, 거래량 급증 배수 ↓
  hits.sort(
    (a, b) => b.changePct - a.changePct || b.volumeMultiple - a.volumeMultiple
  );
  return hits;
}
