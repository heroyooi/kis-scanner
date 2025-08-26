export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { getKisAccessToken } from '@/lib/kisClient';
import { KIS_BASE_URL, ENV } from '@/lib/env';

/**
 * GET /api/kis/price/005930?mrkt=J&tr_id=FHKST01010100
 *  - symbol: 종목코드 6자리 (예: 005930)
 *  - mrkt(J: 주식/ETF/ETN, W: ELW)
 *  - tr_id: 문서에 기재된 TR ID (기본 예시는 FHKST01010100로 둡니다)
 */
export async function GET(
  req: NextRequest,
  ctx: { params: { symbol: string } }
) {
  const symbol = ctx.params.symbol;
  const { searchParams } = new URL(req.url);
  const mrkt = searchParams.get('mrkt') || 'J';
  const trId = searchParams.get('tr_id') || 'FHKST01010100'; // 문서 TR_ID에 맞게 조정

  try {
    const token = await getKisAccessToken();

    const url = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price`;
    const { data } = await axios.get(url, {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        authorization: `Bearer ${token}`,
        appkey: ENV.KIS_APPKEY,
        appsecret: ENV.KIS_APPSECRET,
        tr_id: trId,
        custtype: 'P', // 개인(P) 또는 법인(B) — 문서 기준
      },
      params: {
        FID_COND_MRKT_DIV_CODE: mrkt,
        FID_INPUT_ISCD: symbol,
      },
    });

    return NextResponse.json({ ok: true, data });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}
