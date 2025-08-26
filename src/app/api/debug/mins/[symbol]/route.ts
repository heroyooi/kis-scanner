export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { initFirebaseAdmin } from '@/lib/firebaseAdmin';

export async function GET(_: Request, ctx: { params: { symbol: string } }) {
  const { db } = initFirebaseAdmin();
  const col = db
    .collection('mins')
    .doc(ctx.params.symbol)
    .collection('minutes');
  const snap = await col.orderBy('__name__').get();
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const last = rows.slice(-10);
  return NextResponse.json({ ok: true, count: rows.length, last });
}
