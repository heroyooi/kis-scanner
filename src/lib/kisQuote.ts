import axios from 'axios';
import { getKisAccessToken } from './kisClient';
import { KIS_BASE_URL, ENV } from './env';

/** 단건 현재가 */
export type PriceQuote = {
  symbol: string;
  price: number;
  prevClose: number;
  open: number;
  acmlVol: number; // ✅ 누적 거래량 (분 데이터 차분용)
  raw?: any; // 디버그용 원본
};

type KISQuoteOutput = {
  stck_prpr?: string | number;
  stck_prdy_clpr?: string | number;
  stck_oprc?: string | number;
  acml_vol?: string | number;
  price?: string | number;
  prevClose?: string | number;
  open?: string | number;
};

export async function fetchQuote(
  symbol: string,
  mrkt = 'J',
  trId = 'FHKST01010100'
): Promise<PriceQuote> {
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
    'output' in data && data.output ? data.output : (data as any);

  return {
    symbol,
    price: Number(out.stck_prpr ?? out.price ?? 0),
    prevClose: Number(out.stck_prdy_clpr ?? out.prevClose ?? 0),
    open: Number(out.stck_oprc ?? out.open ?? 0),
    acmlVol: Number((out as any).acml_vol ?? 0), // ✅ 누적 거래량
    raw: data, // (옵션) 디버그용
  };
}
