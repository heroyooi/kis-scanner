import { fetchIntradayCandles } from './kisQuote';
import { initFirebaseAdmin } from '@/lib/firebaseAdmin';

export type ScanParams = {
  volumeLookback?: number;
  volumeK?: number;
  minChangePct?: number;
};

export type ScanHit = {
  symbol: string;
  name?: string;
  lastPrice: number;
  lastVolume: number;
  avgVolumeN: number;
  volumeMultiple: number;
  changePct: number;
  at: string;
};

// Firestore에서 우리가 적재한 의사 분봉 로드
async function loadPseudoCandles(symbol: string) {
  const { db } = initFirebaseAdmin();
  // 오늘 날짜
  const fmt = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const p = Object.fromEntries(
    fmt.formatToParts(new Date()).map((x) => [x.type, x.value])
  );
  const ymd = `${p.year}${p.month}${p.day}`;

  const snap = await db
    .collection('mins')
    .doc(symbol)
    .collection(ymd)
    .orderBy('__name__')
    .get();
  // Candle과 유사 포맷(t/price/vol)으로 변환
  const rows = snap.docs.map((d) => {
    const r = d.data() as any;
    return {
      t: d.id.slice(-4) + '00', // HHMM + "00" → HHMMSS
      o: r.price, // open은 모름 → price 대입
      h: r.price,
      l: r.price,
      c: r.price,
      v: r.vol || 0,
    };
  });
  return rows;
}

function pct(from: number, to: number) {
  if (!from || !to) return 0;
  return ((to - from) / from) * 100;
}

export async function scanOneSymbol(
  symbol: string,
  params: ScanParams
): Promise<ScanHit | null> {
  const { volumeLookback = 20, volumeK = 3, minChangePct = 2 } = params;

  // 1) 먼저 KIS 분봉 시도
  let candles = await fetchIntradayCandles(symbol);

  // 2) 안 되면 Firestore 의사 분봉으로 대체
  if (!candles.length) {
    candles = await loadPseudoCandles(symbol);
  }
  if (!candles.length) return null;

  const last = candles[candles.length - 1];
  const prev = candles.slice(
    Math.max(0, candles.length - 1 - volumeLookback),
    candles.length - 1
  );
  const avgVol = prev.length
    ? prev.reduce((s, r) => s + (r.v || 0), 0) / prev.length
    : 0;

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

export async function runScan(symbols: string[], params: ScanParams) {
  const hits: ScanHit[] = [];
  for (const s of symbols) {
    try {
      const hit = await scanOneSymbol(s, params);
      if (hit) hits.push(hit);
    } catch (e) {
      console.error('[scan error]', s, e);
    }
  }
  hits.sort(
    (a, b) => b.changePct - a.changePct || b.volumeMultiple - a.volumeMultiple
  );
  return hits;
}
