import axios from 'axios';
import { getKisAccessToken } from './kisClient';
import { KIS_BASE_URL, ENV } from './env';

/** KIS 분봉 응답의 가능한 키들을 포괄하는 타입 */
type KISIntradayRow = {
  stck_cntg_hour?: string; // HHMMSS
  stck_oprc?: string | number;
  stck_hgpr?: string | number;
  stck_lwpr?: string | number;
  stck_prpr?: string | number;
  acml_tr_pbmn?: string | number;
  t?: string; // 대체 키
  o?: number | string;
  h?: number | string;
  l?: number | string;
  c?: number | string;
  v?: number | string;
};

type KISIntradayResponse =
  | { output?: KISIntradayRow[]; [k: string]: unknown }
  | { output1?: KISIntradayRow[]; [k: string]: unknown }
  | { chart?: KISIntradayRow[]; [k: string]: unknown };

type Candle = {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

/**
 * KIS 분봉(당일) 데이터 조회
 */
export async function fetchIntradayCandles(
  symbol: string,
  mrkt = 'J',
  trId = 'FHKST03010200'
): Promise<Candle[]> {
  const token = await getKisAccessToken();
  const url = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice`;

  const { data } = await axios.get<KISIntradayResponse>(url, {
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
      // 필요 시: 간격/범위 파라미터 추가
    },
  });

  const list: KISIntradayRow[] =
    'output' in data && Array.isArray(data.output)
      ? data.output
      : 'output1' in data && Array.isArray(data.output1)
      ? data.output1
      : 'chart' in data && Array.isArray(data.chart)
      ? data.chart
      : [];

  // any 회피를 위해 위에서 배열 원소 타입을 KISIntradayRow로 고정했고,
  // 아래에서 안전하게 정규화합니다.
  const rows: Candle[] = list.map((row) => ({
    t: String(row.stck_cntg_hour ?? row.t ?? ''),
    o: Number(row.stck_oprc ?? row.o ?? 0),
    h: Number(row.stck_hgpr ?? row.h ?? 0),
    l: Number(row.stck_lwpr ?? row.l ?? 0),
    c: Number(row.stck_prpr ?? row.c ?? 0),
    v: Number(row.acml_tr_pbmn ?? row.v ?? 0),
  }));

  return rows;
}

/** (선택) 당일 기준가/전일종가 등 간단 시세 */
type KISQuoteOutput = {
  stck_prpr?: string | number;
  stck_prdy_clpr?: string | number;
  stck_oprc?: string | number;
  price?: string | number;
  prevClose?: string | number;
  open?: string | number;
};

export async function fetchQuote(
  symbol: string,
  mrkt = 'J',
  trId = 'FHKST01010100'
): Promise<{ symbol: string; price: number; prevClose: number; open: number }> {
  const token = await getKisAccessToken();
  const url = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price`;

  const { data } = await axios.get<
    { output?: KISQuoteOutput } & KISQuoteOutput
  >(url, {
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
    },
  });

  const out: KISQuoteOutput =
    'output' in data && data.output ? data.output : data;

  return {
    symbol,
    price: Number(out.stck_prpr ?? out.price ?? 0),
    prevClose: Number(out.stck_prdy_clpr ?? out.prevClose ?? 0),
    open: Number(out.stck_oprc ?? out.open ?? 0),
  };
}
