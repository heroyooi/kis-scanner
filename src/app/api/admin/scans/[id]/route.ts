export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { initFirebaseAdmin } from '@/lib/firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';

interface ScanDoc {
  at?: string;
  params?: { n?: number; k?: number; r?: number };
  hits?: unknown[];
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
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

    const { id } = await ctx.params;
    const snap = await db.collection('scans').doc(id).get();
    if (!snap.exists)
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND' },
        { status: 404 }
      );

    const data = snap.data() as ScanDoc | undefined;
    // 안전한 최소 응답
    return NextResponse.json({
      ok: true,
      id: snap.id,
      at: data?.at ?? null,
      params: data?.params ?? null,
      hits: Array.isArray(data?.hits) ? data.hits : [],
    });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json(
      { ok: false, error: err.message || 'INTERNAL' },
      { status: 500 }
    );
  }
}
