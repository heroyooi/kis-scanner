export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { initFirebaseAdmin } from '@/lib/firebaseAdmin';
import { fetchQuote } from '@/lib/kisQuote';

function kstParts(d = new Date()) {
  const fmt = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
}

/**
 * POST /api/debug/mins/seed
 * body: { symbols: ["005930","000660",...], offset?: number } // offset=직전분의 acmlVol을 (현재- offset) 으로 심음
 */
export async function POST(req: Request) {
  try {
    const { db } = initFirebaseAdmin();
    const body = await req.json().catch(() => ({}));
    const symbols: string[] = Array.isArray(body?.symbols) ? body.symbols : [];
    const offset: number = Number(body?.offset ?? 10000); // 기본 1만주 차분

    if (!symbols.length) {
      return NextResponse.json(
        { ok: false, error: 'symbols required' },
        { status: 400 }
      );
    }

    const now = new Date();
    const p = kstParts(now);
    const prev = kstParts(new Date(now.getTime() - 60_000));
    const prevMinuteId = `${prev.year}${prev.month}${prev.day}-${prev.hour}${prev.minute}`;

    const seeded: any[] = [];

    for (const s of symbols) {
      const q = await fetchQuote(s);
      const curAcml = q.acmlVol || 0;
      const prevAcml = Math.max(0, curAcml - offset);

      const col = db.collection('mins').doc(s).collection('minutes');
      await col.doc(prevMinuteId).set(
        {
          t: prevMinuteId,
          price: q.price,
          acmlVol: prevAcml,
          vol: 0,
          at: new Date(now.getTime() - 60_000).toISOString(),
        },
        { merge: true }
      );

      seeded.push({
        symbol: s,
        prevMinuteId,
        prevAcml,
        curAcml,
        price: q.price,
      });
    }

    return NextResponse.json({ ok: true, seeded });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'INTERNAL' },
      { status: 500 }
    );
  }
}
