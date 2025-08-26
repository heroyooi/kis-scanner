// src/app/api/cron/poll/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { initFirebaseAdmin } from '@/lib/firebaseAdmin';
import { fetchQuote } from '@/lib/kisQuote';

export async function POST(req: Request) {
  try {
    const { db } = initFirebaseAdmin();

    const body = await req.json().catch(() => ({}));
    const symbols: string[] = Array.isArray(body?.symbols) ? body.symbols : [];

    if (!symbols.length) {
      return NextResponse.json(
        { ok: false, error: 'symbols required' },
        { status: 400 }
      );
    }

    // KST 기준 분 키
    const now = new Date();
    const fmt = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = Object.fromEntries(
      fmt.formatToParts(now).map((p) => [p.type, p.value])
    );
    const ymd = `${parts.year}${parts.month}${parts.day}`; // 20250826
    const hm = `${parts.hour}${parts.minute}`; // 1625
    const minuteId = `${ymd}-${hm}`;

    const results: any[] = [];

    for (const s of symbols) {
      // 1) 현재가 + 누적 거래량
      const q = await fetchQuote(s);
      const price = q.price;
      const acmlVol = q.acmlVol; // ✅ 누적 거래량

      // 2) 직전 분 스냅샷
      const col = db.collection('mins').doc(s).collection(ymd);
      const prevSnap = await col.orderBy('__name__', 'desc').limit(1).get();
      const prev = prevSnap.empty ? null : (prevSnap.docs[0].data() as any);
      const prevAcml = prev?.acmlVol ?? null;

      // 3) 차분 → 해당 분 거래량
      const perMinVol =
        typeof acmlVol === 'number' &&
        typeof prevAcml === 'number' &&
        acmlVol >= prevAcml
          ? acmlVol - prevAcml
          : 0;

      const payload = {
        t: minuteId,
        price,
        acmlVol,
        vol: perMinVol,
        at: now.toISOString(),
      };

      await col.doc(minuteId).set(payload, { merge: true });
      results.push({ symbol: s, ...payload });
    }

    return NextResponse.json({
      ok: true,
      saved: results.length,
      rows: results,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'INTERNAL' },
      { status: 500 }
    );
  }
}
