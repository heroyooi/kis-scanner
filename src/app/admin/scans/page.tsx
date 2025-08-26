'use client';

import { useCallback, useEffect, useState } from 'react';
import { onIdTokenChanged, getIdToken } from 'firebase/auth';
import { authClient } from '@/lib/firebase.client';
import styles from './scans.module.scss';

type ScanRow = {
  id: string;
  at: string | null;
  params: { k?: number; n?: number; r?: number; symbolsCount?: number } | null;
  hitsCount: number;
};

export default function AdminScansPage() {
  const [token, setToken] = useState<string | null>(null);
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [nextAfter, setNextAfter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 1) 로그인 상태 & 토큰 유지
  useEffect(() => {
    const unsub = onIdTokenChanged(authClient, async (u) => {
      if (u) {
        const t = await getIdToken(u, /* forceRefresh */ false);
        setToken(t);
      } else {
        setToken(null);
      }
    });
    return () => unsub();
  }, []);

  const loadPage = useCallback(
    async (after?: string | null, append = false) => {
      if (!token) return;
      setLoading(true);
      try {
        const url = new URL('/api/admin/scans', window.location.origin);
        url.searchParams.set('limit', '20');
        if (after) url.searchParams.set('after', after);

        const res = await fetch(url.toString(), {
          headers: { authorization: `Bearer ${token}` },
        });
        const json = await res.json();

        if (!json.ok) throw new Error(json.error || 'fail');

        setNextAfter(json.nextAfter || null);
        setRows((prev) => (append ? [...prev, ...json.items] : json.items));
      } catch (e) {
        console.error(e);
        alert('불러오기에 실패했습니다.');
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  // 2) 최초 로드
  useEffect(() => {
    if (token) loadPage();
  }, [token, loadPage]);

  if (!token) {
    return (
      <div className={styles.wrap}>
        <h1>스캔 히스토리</h1>
        <p>관리자 로그인이 필요합니다.</p>
        <p>
          <a href='/login'>로그인 페이지로 이동</a>
        </p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h1>스캔 히스토리</h1>
        <div className={styles.actions}>
          <button disabled={loading} onClick={() => loadPage(undefined, false)}>
            새로고침
          </button>
          <button
            disabled={loading || !nextAfter}
            onClick={() => loadPage(nextAfter, true)}
          >
            더 보기
          </button>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>시각(ID)</th>
              <th>매개변수</th>
              <th>심볼수</th>
              <th>히트개수</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <div className={styles.id}>{r.id}</div>
                  <div className={styles.at}>{r.at}</div>
                </td>
                <td>
                  n={r.params?.n ?? '-'}, k={r.params?.k ?? '-'}, r=
                  {r.params?.r ?? '-'}
                </td>
                <td>{r.params?.symbolsCount ?? '-'}</td>
                <td>
                  <a href={`/admin/scans/${r.id}`}>{r.hitsCount}</a>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={4} className={styles.empty}>
                  데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
