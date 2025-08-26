export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { initFirebaseAdmin } from '@/lib/firebaseAdmin';

export async function GET() {
  try {
    const { db } = initFirebaseAdmin();
    const ref = db.collection('healthchecks').doc('firestore');
    const now = new Date().toISOString();
    await ref.set({ ok: true, at: now }, { merge: true });
    const snap = await ref.get();
    return NextResponse.json({ ok: true, readBack: snap.data() });
  } catch (e: unknown) {
    const err = e as Error & { name?: string; code?: string; details?: unknown };
    return NextResponse.json(
      {
        ok: false,
        name: err.name,
        code: err.code,
        message: err.message,
        details: err.details,
        stack: err.stack,
      },
      { status: 500 }
    );
  }
}
