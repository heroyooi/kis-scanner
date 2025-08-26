import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase-admin/app';

import { getMinuteQuotes } from './kisClient';
import { calcEMA, calcVWAP } from './indicators';
import { checkHit, PresetName } from './scanner';

initializeApp();
const db = getFirestore();

// 런타임 캐시(인스턴스 생존 동안 유지)
type SymbolState = {
  ema5?: number;
  cumPV: number;
  cumVol: number;
  dayHigh: number;
  closes: number[]; // 최근 10~11개 close
  volumes: number[]; // 최근 10~11개 분당 거래량
};
const state: Record<string, SymbolState> = {};

const PRESETS: PresetName[] = ['base']; // 시작은 '기본'만

export const scanMinute = onSchedule(
  { schedule: '* * * * *', timeZone: 'Asia/Seoul' }, // 매 분
  async () => {
    const now = new Date();
    const ymd = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const hhmm = now.toTimeString().slice(0, 5).replace(':', ''); // HHmm

    // TODO: 실제 심볼 풀 로딩 (KRX 전 종목/거래가능)
    const symbols = ['005930', '000660', '035420'];

    logger.info(`scanMinute start: ${ymd} ${hhmm}, symbols=${symbols.length}`);
    const quotes = await getMinuteQuotes(symbols);

    for (const q of quotes) {
      const key = q.symbol;
      const s: SymbolState = state[key] ?? {
        ema5: undefined,
        cumPV: 0,
        cumVol: 0,
        dayHigh: 0,
        closes: [],
        volumes: [],
      };

      const typical = (q.high + q.low + q.close) / 3;
      const ema5 = (s.ema5 = calcEMA(s.ema5, q.close, 5));
      const { vwap, cumPV, cumVol } = calcVWAP(
        s.cumPV,
        s.cumVol,
        typical,
        q.volume
      );
      s.cumPV = cumPV;
      s.cumVol = cumVol;

      // 최근 3분/10분 윈도우 계산용 큐
      s.closes.push(q.close);
      if (s.closes.length > 11) s.closes.shift();
      s.volumes.push(q.volume);
      if (s.volumes.length > 11) s.volumes.shift();

      const close3mAgo =
        s.closes.length >= 4 ? s.closes[s.closes.length - 4] : q.close;
      const pct3m = close3mAgo ? (q.close / close3mAgo - 1) * 100 : 0;

      const last10 = s.volumes.slice(-10);
      const avg10 = last10.length
        ? last10.reduce((a, b) => a + b, 0) / last10.length
        : q.volume;
      const volSpike10 = avg10 ? q.volume / avg10 : 0;

      const dayHighUpdated = q.high > s.dayHigh;
      if (dayHighUpdated) s.dayHigh = q.high;

      const tickDoc = {
        ts: Timestamp.now(),
        price: q.price,
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume,
        value: q.value,
        vwap,
        ema5,
        pct3m,
        volSpike10,
        dayHighUpdated,
        halted: !!q.halted,
        viTriggered: !!q.viTriggered,
      };

      // 저장
      await db
        .doc(`ticks/${ymd}/${q.symbol}/${hhmm}`)
        .set(tickDoc, { merge: true });

      // 스캔
      for (const p of PRESETS) {
        const res = checkHit(p, {
          price: q.price,
          open: q.open,
          high: q.high,
          low: q.low,
          close: q.close,
          volume: q.volume,
          value: q.value,
          ema5,
          vwap,
          pct3m,
          volSpike10,
          dayHighUpdated,
          halted: !!q.halted,
          viTriggered: !!q.viTriggered,
        });

        if (res.hit) {
          const hitDoc = {
            ts: Timestamp.now(),
            ymd,
            hhmm,
            preset: p,
            symbol: q.symbol,
            price: q.price,
            value: q.value,
            volSpike10,
            pct3m,
            vwapGap: vwap ? (q.price / vwap - 1) * 100 : 0,
            tags: res.tags,
            createdAt: Timestamp.now(),
          };

          // 파티셔닝 컬렉션
          await db.collection(`scanHits/${ymd}/${hhmm}`).add(hitDoc);
          // 평탄화 컬렉션(관리 UI 용)
          await db.collection('scanHitsFlat').add(hitDoc);
        }
      }

      state[key] = s;
    }

    logger.info(`scanMinute done: ${ymd} ${hhmm}`);
  }
);
