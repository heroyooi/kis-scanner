export const runtime = 'nodejs';
import { NextResponse } from 'next/server';

export async function GET() {
  const { KIS_APPKEY, KIS_APPSECRET, KIS_PAPER } = process.env;
  return NextResponse.json({
    paper: KIS_PAPER,
    appkey_len: KIS_APPKEY?.length ?? 0,
    appsecret_len: KIS_APPSECRET?.length ?? 0,
  });
}
