export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { initFirebaseAdmin } from '@/lib/firebaseAdmin';
import { runScan } from '@/lib/scanner';

/**
 * 실행 예:
 *  GET /api/scan/run
 *  GET /api/scan/run?symbols=005930,000660,035420&k=3&n=20&r=2
 */
export async function GET(req: NextRequest) {
  try {
    const { db } = initFirebaseAdmin();

    const sp = new URL(req.url).searchParams;

    // 1) 대상 종목: 쿼리 또는 Firestore에서 로드
    const symbolsParam = sp.get('symbols'); // ✅ const로 변경
    let symbols: string[] = [];
    if (symbolsParam) {
      symbols = symbolsParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      // Firestore에서 universe 로드 (컬렉션: scannerUniverse, 문서ID=종목코드)
      const snap = await db.collection('scannerUniverse').get();
      symbols = snap.docs.map((d) => d.id);
    }
    if (!symbols.length) {
      return NextResponse.json(
        {
          ok: false,
          error: '심볼이 없습니다(symbols 쿼리 또는 scannerUniverse 컬렉션)',
        },
        { status: 400 }
      );
    }

    // 2) 파라미터
    const n = Number(sp.get('n') || 20); // 직전 N봉 평균
    const k = Number(sp.get('k') || 3); // k배
    const r = Number(sp.get('r') || 2); // 등락률 하한(%)

    const hits = await runScan(symbols, {
      volumeLookback: n,
      volumeK: k,
      minChangePct: r,
    });

    // 3) 저장: scans/{yyyyMMddHHmm}
    const now = new Date();
    const id = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
    ].join('');

    await db
      .collection('scans')
      .doc(id)
      .set(
        {
          at: now.toISOString(),
          params: { n, k, r, symbolsCount: symbols.length },
          hits,
        },
        { merge: true }
      );

    return NextResponse.json({ ok: true, count: hits.length, id, hits });
  } catch (err: unknown) {
    // ✅ any 대신 unknown 사용
    if (err instanceof Error) {
      return NextResponse.json(
        { ok: false, error: err.message, stack: err.stack },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: false, error: 'Unknown error' },
      { status: 500 }
    );
  }
}
