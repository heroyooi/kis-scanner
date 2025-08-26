export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { initFirebaseAdmin } from '@/lib/firebaseAdmin';
import { fetchIntradayCandles } from '@/lib/kisQuote';

async function loadPseudoCandles(symbol: string) {
  const { db } = initFirebaseAdmin();
  const snap = await db
    .collection('mins')
    .doc(symbol)
    .collection('minutes')
    .orderBy('__name__')
    .get();
  return snap.docs.map((d) => {
    const r = d.data() as any;
    return {
      t: d.id.slice(-4) + '00',
      o: r.price,
      h: r.price,
      l: r.price,
      c: r.price,
      v: r.vol || 0,
    };
  });
}

export async function GET(_: Request, ctx: { params: { symbol: string } }) {
  try {
    // 1) 우리 데이터
    let rows = await loadPseudoCandles(ctx.params.symbol);
    // 2) 없으면 KIS 분봉 시도(권한 되면 자동 사용)
    if (!rows.length) rows = await fetchIntradayCandles(ctx.params.symbol);
    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'INTERNAL' },
      { status: 500 }
    );
  }
}
