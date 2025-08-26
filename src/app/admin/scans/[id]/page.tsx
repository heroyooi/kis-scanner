// src/app/admin/scans/[id]/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { onIdTokenChanged, getIdToken } from 'firebase/auth';
import dynamic from 'next/dynamic';
import { authClient } from '@/lib/firebase.client';
import styles from './detail.module.scss';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

type Hit = {
  symbol: string;
  lastPrice: number; // 최근 봉 종가
  lastVolume: number; // 최근 봉 거래량(분)
  avgVolumeN: number;
  volumeMultiple: number;
  changePct: number;
  at: string; // ISO (스캔 시각)
  name?: string;
};

type Candle = {
  t: string | number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

// ▽ 보조 컬럼용 요약 타입
type Summary = {
  name?: string | null;
  price?: number | null;
  listedShares?: number | null;
  marketCap?: number | null; // 원 단위
};

type ScanParams = { n?: number; k?: number; r?: number };

export default function ScanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [token, setToken] = useState<string | null>(null);
  const [hits, setHits] = useState<Hit[]>([]);
  const [meta, setMeta] = useState<{ at?: string; params?: ScanParams } | null>(
    null
  );
  const [selected, setSelected] = useState<string | null>(null);

  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);

  // ▽ 종목 요약 캐시 (종목명/시총)
  const [summaries, setSummaries] = useState<Record<string, Summary>>({});

  // 로그인 토큰
  useEffect(() => {
    const unsub = onIdTokenChanged(authClient, async (u) => {
      if (u) setToken(await getIdToken(u, false));
      else setToken(null);
    });
    return () => unsub();
  }, []);

  // 상세 로드 + 요약 병렬 로드
  useEffect(() => {
    if (!token) return;
    (async () => {
      const res = await fetch(`/api/admin/scans/${id}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      if (!j.ok) {
        alert(j.error || '불러오기 실패');
        return;
      }
      setHits(j.hits || []);
      setMeta({ at: j.at, params: j.params });
      if ((j.hits || []).length) setSelected(j.hits[0].symbol);

      // ▽ 종목 요약(이름/시총) 병렬 로드
      const uniq = Array.from(
        new Set((j.hits || []).map((h: Hit) => h.symbol))
      );
      const fetched: Record<string, Summary> = {};
      await Promise.all(
        uniq.map(async (s) => {
          try {
            const r = await fetch(`/api/kis/summary/${s}`);
            const sj = await r.json();
            if (sj?.ok) {
              fetched[s] = {
                name: sj.name ?? null,
                price: sj.price ?? null,
                listedShares: sj.listedShares ?? null,
                marketCap: sj.marketCap ?? null,
              };
            }
          } catch {
            // 무시
          }
        })
      );
      setSummaries(fetched);
    })();
  }, [token, id]);

  // 차트 데이터 로드 (KIS 분봉 프록시 사용)
  useEffect(() => {
    if (!selected) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/kis/intraday/${selected}`);
        const j = await res.json();
        const rows: unknown[] =
          j?.data?.output ||
          j?.data?.output1 ||
          j?.data?.chart ||
          j?.data ||
          [];
        const mapped: Candle[] = rows.map((r) => {
          const row = r as { [k: string]: string | number | undefined };
          return {
            t: row.stck_cntg_hour ?? row.t ?? '', // HHMMSS or timestamp
            o: Number(row.stck_oprc ?? row.o ?? 0),
            h: Number(row.stck_hgpr ?? row.h ?? 0),
            l: Number(row.stck_lwpr ?? row.l ?? 0),
            c: Number(row.stck_prpr ?? row.c ?? 0),
            v: Number(row.acml_tr_pbmn ?? row.v ?? 0),
          };
        });
        setCandles(mapped);
      } catch (e) {
        console.error(e);
        setCandles([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [selected]);

  // ▽ 급증 시점 라벨(HHMMSS) 구하기: 스캔 히트의 at(ISO) → "HH:MM:SS" → "HHMMSS"
  const spikeLabel = useMemo(() => {
    const hit = hits.find((h) => h.symbol === selected);
    if (!hit?.at) return null;
    const hhmmss = hit.at.slice(11, 19); // "HH:MM:SS"
    return hhmmss.replaceAll(':', ''); // "HHMMSS"
  }, [hits, selected]);

  // 차트 옵션 (급증 마커 추가)
  const chartOption = useMemo(() => {
    const x = candles.map((r) => String(r.t));
    const close = candles.map((r) => r.c);
    const vol = candles.map((r) => r.v);

    const spikeIndex = spikeLabel ? x.findIndex((xx) => xx === spikeLabel) : -1;
    const spikeX = spikeIndex >= 0 ? x[spikeIndex] : null;
    const spikeY = spikeIndex >= 0 ? close[spikeIndex] : null;

    return {
      tooltip: { trigger: 'axis' },
      grid: [
        { left: 50, right: 20, top: 20, height: 200 },
        { left: 50, right: 20, top: 240, height: 80 },
      ],
      xAxis: [
        { type: 'category', data: x, boundaryGap: false, gridIndex: 0 },
        { type: 'category', data: x, boundaryGap: false, gridIndex: 1 },
      ],
      yAxis: [
        { type: 'value', scale: true, gridIndex: 0 },
        { type: 'value', gridIndex: 1 },
      ],
      series: [
        {
          name: 'Close',
          type: 'line',
          data: close,
          smooth: true,
          xAxisIndex: 0,
          yAxisIndex: 0,
          // ▽ 급증 마커(가격 라인 위)
          markPoint:
            spikeX && spikeY
              ? {
                  data: [
                    { name: 'Spike', coord: [spikeX, spikeY], value: '급증' },
                  ],
                  label: { show: true, formatter: '급증' },
                  symbolSize: 50,
                }
              : undefined,
          // ▽ 급증 수직선
          markLine: spikeX
            ? {
                data: [{ xAxis: spikeX }],
                label: { show: true, formatter: '급증 시점' },
              }
            : undefined,
        },
        {
          name: 'Volume',
          type: 'bar',
          data: vol,
          xAxisIndex: 1,
          yAxisIndex: 1,
          // 필요시 거래량 영역에도 마커 가능 (여긴 생략)
        },
      ],
      dataZoom: [
        { type: 'inside', xAxisIndex: [0, 1] },
        { type: 'slider', xAxisIndex: [0, 1] },
      ],
    };
  }, [candles, spikeLabel]);

  // 표시 포맷터
  const fmtKR = (n?: number | null, digits = 0) =>
    typeof n === 'number'
      ? n.toLocaleString(undefined, { maximumFractionDigits: digits })
      : '-';

  const getSummary = (sym: string): Summary => summaries[sym] || {};

  return (
    <>
      <div className={styles.wrap}>
        <div className={styles.head}>
          <h1>스캔 상세</h1>
          <div className={styles.meta}>
            <span>ID: {id}</span>
            <span>시간: {meta?.at ?? '-'}</span>
            <span>
              조건: n={meta?.params?.n ?? '-'}, k={meta?.params?.k ?? '-'}, r=
              {meta?.params?.r ?? '-'}
            </span>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.left}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>종목</th>
                  <th>종목명</th> {/* 추가 */}
                  <th>현재가</th>
                  <th>급증배수</th>
                  <th>등락%</th>
                  <th>거래대금(분)</th> {/* 추가: lastPrice * lastVolume */}
                  <th>시가총액</th> {/* 추가 */}
                  <th>시각</th>
                </tr>
              </thead>
              <tbody>
                {hits.map((h) => {
                  const sum = getSummary(h.symbol);
                  const turnover = (h.lastPrice || 0) * (h.lastVolume || 0); // 원 단위(분)
                  return (
                    <tr
                      key={h.symbol}
                      className={selected === h.symbol ? styles.active : ''}
                      onClick={() => setSelected(h.symbol)}
                    >
                      <td>{h.symbol}</td>
                      <td>{sum?.name ?? '-'}</td>
                      <td>{fmtKR(h.lastPrice)}</td>
                      <td>{h.volumeMultiple}</td>
                      <td>{h.changePct}</td>
                      <td>{fmtKR(turnover)}</td>
                      <td>{sum?.marketCap ? fmtKR(sum.marketCap) : '-'}</td>
                      <td>{h.at?.slice(11, 19)}</td>
                    </tr>
                  );
                })}
                {!hits.length && (
                  <tr>
                    <td colSpan={8} className={styles.empty}>
                      히트가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className={styles.right}>
            <div className={styles.chartHead}>
              <h2>{selected ?? '종목 선택'}</h2>
            </div>
            <div className={styles.chartArea}>
              {selected ? (
                loading ? (
                  <p>차트 불러오는 중…</p>
                ) : (
                  <ReactECharts option={chartOption} style={{ height: 360 }} />
                )
              ) : (
                <p>왼쪽 표에서 종목을 선택하세요.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
