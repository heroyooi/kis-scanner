export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import axios from 'axios';
import { getKisAccessToken } from '@/lib/kisClient';
import { KIS_BASE_URL, ENV } from '@/lib/env';

export async function GET(_: Request, ctx: { params: { symbol: string } }) {
  try {
    const token = await getKisAccessToken();
    const { data } = await axios.get(
      `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price`,
      {
        headers: {
          'content-type': 'application/json; charset=utf-8',
          authorization: `Bearer ${token}`,
          appkey: ENV.KIS_APPKEY,
          appsecret: ENV.KIS_APPSECRET,
          tr_id: 'FHKST01010100',
          custtype: 'P',
        },
        params: {
          FID_COND_MRKT_DIV_CODE: 'J',
          FID_INPUT_ISCD: ctx.params.symbol,
        },
      }
    );
    return NextResponse.json({
      ok: true,
      rt_cd: data?.rt_cd,
      msg_cd: data?.msg_cd,
      msg1: data?.msg1,
      output: data?.output || null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'INTERNAL' },
      { status: 500 }
    );
  }
}
