export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { initFirebaseAdmin } from '@/lib/firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const { db } = initFirebaseAdmin();

    const authz = req.headers.get('authorization') || '';
    const token = authz.startsWith('Bearer ') ? authz.slice(7) : '';
    if (!token)
      return NextResponse.json(
        { ok: false, error: 'UNAUTHORIZED' },
        { status: 401 }
      );
    await getAuth().verifyIdToken(token);

    const snap = await db.collection('scans').doc(ctx.params.id).get();
    if (!snap.exists)
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND' },
        { status: 404 }
      );

    const data = snap.data() as any;
    // 안전한 최소 응답
    return NextResponse.json({
      ok: true,
      id: snap.id,
      at: data?.at ?? null,
      params: data?.params ?? null,
      hits: Array.isArray(data?.hits) ? data.hits : [],
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'INTERNAL' },
      { status: 500 }
    );
  }
}
