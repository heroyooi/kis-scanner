export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { getKisAccessToken } from '@/lib/kisClient';
import { KIS_BASE_URL, ENV } from '@/lib/env';

/**
 * GET /api/kis/summary/005930
 * - 종목명(한글), 현재가, 상장주식수 추정 -> 시가총액 계산(원)
 * - KIS 응답 키는 계정/버전에 따라 다를 수 있어 안전하게 파싱
 */
export async function GET(
  req: NextRequest,
  ctx: { params: { symbol: string } }
) {
  try {
    const symbol = ctx.params.symbol;
    const token = await getKisAccessToken();

    const url = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price`;
    const { data } = await axios.get(url, {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        authorization: `Bearer ${token}`,
        appkey: ENV.KIS_APPKEY,
        appsecret: ENV.KIS_APPSECRET,
        tr_id: 'FHKST01010100', // 표준 현재가 TR (환경에 맞게 조절 가능)
        custtype: 'P',
      },
      params: {
        FID_COND_MRKT_DIV_CODE: 'J',
        FID_INPUT_ISCD: symbol,
      },
    });

    const out = data?.output || data;
    const name = out?.hts_kor_isnm ?? out?.stockName ?? null;
    const price = Number(out?.stck_prpr ?? out?.price ?? 0);
    // 상장주식수(주) 추정 키 후보 (계정/문서에 따라 다름)
    const listedShares = Number(
      out?.lstn_stcn ?? out?.list_shrs ?? out?.listedShares ?? 0
    );

    const marketCap = listedShares && price ? listedShares * price : null;

    return NextResponse.json({
      ok: true,
      symbol,
      name,
      price,
      listedShares: listedShares || null,
      marketCap, // 원 단위
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'INTERNAL' },
      { status: 500 }
    );
  }
}
