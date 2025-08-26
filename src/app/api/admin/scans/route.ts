export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { initFirebaseAdmin } from '@/lib/firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';

interface ScanDoc {
  at?: FirebaseFirestore.Timestamp | string | null;
  params?: { n?: number; k?: number; r?: number; symbolsCount?: number } | null;
  hitsCount?: number;
}

export async function GET(req: NextRequest) {
  try {
    const { db } = initFirebaseAdmin();

    const authz = req.headers.get('authorization') || '';
    const token = authz.startsWith('Bearer ') ? authz.slice(7) : '';
    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    await getAuth().verifyIdToken(token);

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit') || 20), 100);
    const after = searchParams.get('after');

    // ✅ scans 컬렉션에서 문서ID(runId: yyyymmddhhmm) 역순 페이징
    let ref = db.collection('scans').orderBy('__name__', 'desc').limit(limit);
    if (after) {
      const afterSnap = await db.collection('scans').doc(after).get();
      if (afterSnap.exists) ref = ref.startAfter(afterSnap);
    }

    const snap = await ref.get();
    const items = snap.docs.map((d) => {
      const data = d.data() as ScanDoc;
      // at은 Timestamp이거나 문자열일 수 있음 → ISO 문자열로 통일
      let at: string | null = null;
      if (data?.at && typeof (data.at as any).toDate === 'function') {
        at = (data.at as FirebaseFirestore.Timestamp).toDate().toISOString();
      } else if (typeof data?.at === 'string') {
        at = data.at;
      }

      return {
        id: d.id,
        at,
        params: data?.params ?? null,
        hitsCount: typeof data?.hitsCount === 'number' ? data.hitsCount : 0,
      };
    });

    const nextAfter = snap.docs.length
      ? snap.docs[snap.docs.length - 1].id
      : null;
    return NextResponse.json({ ok: true, items, nextAfter, limit });
  } catch (e: any) {
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
