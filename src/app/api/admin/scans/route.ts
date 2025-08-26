// src/app/api/admin/scans/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { initFirebaseAdmin } from '@/lib/firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';

export async function GET(req: NextRequest) {
  try {
    // ✅ 1) 먼저 Admin 초기화 (기본 앱 생성)
    const { db } = initFirebaseAdmin();

    // ✅ 2) 그 다음 ID 토큰 검증
    const authz = req.headers.get('authorization') || '';
    const token = authz.startsWith('Bearer ') ? authz.slice(7) : '';
    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    await getAuth().verifyIdToken(token);

    // ✅ 3) Firestore 조회
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit') || 20), 100);
    const after = searchParams.get('after');

    let ref = db.collection('scans').orderBy('__name__', 'desc').limit(limit);
    if (after) {
      const afterSnap = await db.collection('scans').doc(after).get();
      if (afterSnap.exists) ref = ref.startAfter(afterSnap);
    }

    const snap = await ref.get();
    const items = snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        at: data?.at ?? null,
        params: data?.params ?? null,
        hitsCount: Array.isArray(data?.hits) ? data.hits.length : 0,
      };
    });

    const nextAfter = snap.docs.length
      ? snap.docs[snap.docs.length - 1].id
      : null;
    return NextResponse.json({ ok: true, items, nextAfter, limit });
  } catch (e: any) {
    // 임시로 에러 정보를 내려서 원인 확인 (문제 해결 후 제거해도 됨)
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || 'INTERNAL',
        name: e?.name,
        code: e?.code,
      },
      { status: 500 }
    );
  }
}
