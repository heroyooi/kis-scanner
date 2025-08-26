export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import axios from 'axios';
import { getKisAccessToken } from '@/lib/kisClient';
import { KIS_BASE_URL, ENV } from '@/lib/env';
import { fetchIntradayCandles } from '@/lib/kisQuote';

function ymdKST() {
  const s = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date())
    .replace(/[^\d]/g, '');
  return s;
}

export async function GET(req: Request, ctx: { params: { symbol: string } }) {
  try {
    const urlObj = new URL(req.url);
    const limit = Number(urlObj.searchParams.get('limit') || 5);

    // 1) 우리 정규화 결과
    const rows = await fetchIntradayCandles(ctx.params.symbol);
    const lastN = rows.slice(-Math.max(1, limit));

    // 2) 원문 그대로 찍기 (status/headers/데이터 문자열화)
    const token = await getKisAccessToken();
    const res = await axios.get(
      `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice`,
      {
        validateStatus: () => true, // 어떤 상태든 받기
        headers: {
          'content-type': 'application/json; charset=utf-8',
          authorization: `Bearer ${token}`,
          appkey: ENV.KIS_APPKEY,
          appsecret: ENV.KIS_APPSECRET,
          tr_id: 'FHKST03010200',
          custtype: 'P',
        },
        params: {
          FID_COND_MRKT_DIV_CODE: 'J',
          FID_INPUT_ISCD: ctx.params.symbol,
          FID_INPUT_DATE_1: ymdKST(),
          FID_INPUT_HOUR_1: '090000',
          FID_PW_DATA_INCU_YN: 'Y',
          FID_PERIOD_DIV_CODE: '1',
          FID_ORG_ADJ_PRC: '1',
        },
      }
    );

    // 원문 요약
    let rawData = res.data;
    let rawStr = '';
    try {
      rawStr =
        typeof rawData === 'string'
          ? rawData
          : JSON.stringify(rawData).slice(0, 2000);
    } catch {
      rawStr = '[unserializable]';
    }

    const topKeys =
      rawData && typeof rawData === 'object' ? Object.keys(rawData) : [];
    const rowKeys =
      (rawData?.output &&
        Array.isArray(rawData.output) &&
        Object.keys(rawData.output[0] || {})) ||
      (rawData?.output1 &&
        Array.isArray(rawData.output1) &&
        Object.keys(rawData.output1[0] || {})) ||
      (rawData?.output2 &&
        Array.isArray(rawData.output2) &&
        Object.keys(rawData.output2[0] || {})) ||
      (rawData?.chart &&
        Array.isArray(rawData.chart) &&
        Object.keys(rawData.chart[0] || {})) ||
      [];

    return NextResponse.json({
      ok: true,
      normalizedCount: rows.length,
      preview: lastN.map((r) => ({ t: r.t, c: r.c, v: r.v })),
      // 원문 요약
      httpStatus: res.status,
      rt_cd: rawData?.rt_cd ?? null,
      msg_cd: rawData?.msg_cd ?? null,
      msg1: rawData?.msg1 ?? null,
      topKeys,
      rowKeys,
      rawSnippet: rawStr,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'INTERNAL' },
      { status: 500 }
    );
  }
}
