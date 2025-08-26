export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { getKisAccessToken } from '@/lib/kisClient';
import { KIS_BASE_URL, ENV } from '@/lib/env';

/**
 * GET /api/kis/intraday/005930?mrkt=J&tr_id=FHKST03010200&time=1
 *  - time: 분 간격(예: 1, 3, 5…), 문서 파라미터에 맞게 설정
 */
export async function GET(
  req: NextRequest,
  ctx: { params: { symbol: string } }
) {
  const symbol = ctx.params.symbol;
  const { searchParams } = new URL(req.url);
  const mrkt = searchParams.get('mrkt') || 'J';
  const trId = searchParams.get('tr_id') || 'FHKST03010200'; // 문서 확인 필요

  try {
    const token = await getKisAccessToken();

    const url = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice`;
    const { data } = await axios.get(url, {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        authorization: `Bearer ${token}`,
        appkey: ENV.KIS_APPKEY,
        appsecret: ENV.KIS_APPSECRET,
        tr_id: trId,
        custtype: 'P',
      },
      params: {
        FID_COND_MRKT_DIV_CODE: mrkt,
        FID_INPUT_ISCD: symbol,
        // 분봉 관련 파라미터는 문서 스펙에 맞춰 추가하세요.
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
