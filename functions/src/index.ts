import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { getMinuteQuotes } from './kisClient';
import { calcEMA, calcVWAP } from './indicators';
import { checkHit, PresetName } from './scanner';

// ==== Firebase Admin ====
initializeApp();
const db = getFirestore();

// ==== 런타임 캐시(함수 인스턴스 생존 동안 유지) ====
type SymbolState = {
  ema5?: number;
  cumPV: number;
  cumVol: number;
  dayHigh: number;
  closes: number[]; // 최근 10~11개 종가
  volumes: number[]; // 최근 10~11개 분당 거래량
};
const state: Record<string, SymbolState> = {};

// 스캔 프리셋(필요 시 'aggressive' 추가/조정)
const PRESETS: PresetName[] = ['base'];

// ==== 메인 스케줄러: 매 분 실행 ====
export const scanMinute = onSchedule(
  { schedule: '* * * * *', timeZone: 'Asia/Seoul' },
  async () => {
    const now = new Date();
    const ymd = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const hhmm = now.toTimeString().slice(0, 5).replace(':', ''); // HHmm
    const runId = `${ymd}${hhmm}`; // 분 실행 ID (문서 ID로 사용)

    // TODO: 실제 심볼 풀 로딩(상장/거래정지 제외)로 교체
    const symbols = ['005930', '000660', '035420'];

    logger.info(`scanMinute start ${runId} | symbols=${symbols.length}`);

    // 분 실행 요약 집계 변수
    let hitsCount = 0;
    let triedSymbols = 0;

    // 시세 조회 (MVP: 직렬 호출; 추후 p-limit 등으로 동시성 제어)
    const quotes = await getMinuteQuotes(symbols);

    for (const q of quotes) {
      triedSymbols++;

      // ---- 상태 초기화/로드 ----
      const key = q.symbol;
      const s: SymbolState = state[key] ?? {
        ema5: undefined,
        cumPV: 0,
        cumVol: 0,
        dayHigh: 0,
        closes: [],
        volumes: [],
      };

      // ---- 파생지표 계산 ----
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

      // 최근 3분/10분 윈도우용 큐
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

      // ---- 분 스냅샷 저장: ticks/{YYYYMMDD}/{symbol}/{HHmm} ----
      const tickDoc = {
        ts: Timestamp.now(),
        price: q.price,
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume,
        value: q.value, // 분 거래대금(원)으로 매핑되도록 kisClient에서 계산/파싱 필요
        vwap,
        ema5,
        pct3m,
        volSpike10,
        dayHighUpdated,
        halted: !!q.halted,
        viTriggered: !!q.viTriggered,
      };

      await db
        .doc(`ticks/${ymd}/${q.symbol}/${hhmm}`)
        .set(tickDoc, { merge: true });

      // ---- 스캔 규칙 평가 & 히트 저장 ----
      for (const preset of PRESETS) {
        const res = checkHit(preset, {
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
          hitsCount++;
          const hitDoc = {
            ts: Timestamp.now(),
            ymd,
            hhmm,
            preset,
            symbol: q.symbol,
            price: q.price,
            value: q.value,
            volSpike10,
            pct3m,
            vwapGap: vwap ? (q.price / vwap - 1) * 100 : 0,
            tags: res.tags,
            createdAt: Timestamp.now(),
          };

          // 파티셔닝 컬렉션 (분 단위)
          await db.collection(`scanHits/${ymd}/${hhmm}`).add(hitDoc);
          // 평탄화 컬렉션 (관리 UI 질의용)
          await db.collection('scanHitsFlat').add(hitDoc);
        }
      }

      // 상태 저장(다음 분 계산에 사용)
      state[key] = s;
    }

    // ---- 분 실행 요약 저장: scans/{runId} ----
    await db.doc(`scans/${runId}`).set(
      {
        at: Timestamp.now(), // 실행 시각
        params: { n: null, k: null, r: null, symbolsCount: triedSymbols },
        hitsCount,
      },
      { merge: true }
    );

    logger.info(
      `scanMinute done ${runId} | symbols=${triedSymbols} | hits=${hitsCount}`
    );
  }
);
