'use client';

import { useEffect, useMemo, useState } from 'react';
import { onIdTokenChanged, getIdToken } from 'firebase/auth';
import dynamic from 'next/dynamic';
import { authClient } from '@/lib/firebase.client';
import styles from './detail.module.scss';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

type Hit = {
  symbol: string;
  lastPrice: number;
  lastVolume: number;
  avgVolumeN: number;
  volumeMultiple: number;
  changePct: number;
  at: string;
  name?: string;
};

export default function ScanDetailPage({ params }: { params: { id: string } }) {
  const [token, setToken] = useState<string | null>(null);
  const [hits, setHits] = useState<Hit[]>([]);
  type ScanParams = { n?: number; k?: number; r?: number };
  const [meta, setMeta] =
    useState<{ at?: string; params?: ScanParams } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  type Candle = { t: string | number; o: number; h: number; l: number; c: number; v: number };
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);

  // 로그인 토큰
  useEffect(() => {
    const unsub = onIdTokenChanged(authClient, async (u) => {
      if (u) setToken(await getIdToken(u, false));
      else setToken(null);
    });
    return () => unsub();
  }, []);

  // 상세 로드
  useEffect(() => {
    if (!token) return;
    (async () => {
      const res = await fetch(`/api/admin/scans/${params.id}`, {
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
    })();
  }, [token, params.id]);

  // 차트 데이터 로드 (KIS 분봉 프록시 사용)
  useEffect(() => {
    if (!selected) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/kis/intraday/${selected}`);
        const j = await res.json();
        // j.data 의 포맷에 맞춰 정규화 (fetchIntradayCandles와 동일 구조 가정)
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

  const chartOption = useMemo(() => {
    const x = candles.map((r) => r.t);
    const close = candles.map((r) => r.c);
    const vol = candles.map((r) => r.v);
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
        },
        {
          name: 'Volume',
          type: 'bar',
          data: vol,
          xAxisIndex: 1,
          yAxisIndex: 1,
        },
      ],
      dataZoom: [
        { type: 'inside', xAxisIndex: [0, 1] },
        { type: 'slider', xAxisIndex: [0, 1] },
      ],
    };
  }, [candles]);

  return (
    <>
      <div className={styles.wrap}>
        <div className={styles.head}>
          <h1>스캔 상세</h1>
          <div className={styles.meta}>
            <span>ID: {params.id}</span>
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
                  <th>현재가</th>
                  <th>급증배수</th>
                  <th>등락%</th>
                  <th>시각</th>
                </tr>
              </thead>
              <tbody>
                {hits.map((h) => (
                  <tr
                    key={h.symbol}
                    className={selected === h.symbol ? styles.active : ''}
                    onClick={() => setSelected(h.symbol)}
                  >
                    <td>{h.symbol}</td>
                    <td>{h.lastPrice?.toLocaleString?.()}</td>
                    <td>{h.volumeMultiple}</td>
                    <td>{h.changePct}</td>
                    <td>{h.at?.slice(11, 19)}</td>
                  </tr>
                ))}
                {!hits.length && (
                  <tr>
                    <td colSpan={5} className={styles.empty}>
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
