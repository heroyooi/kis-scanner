import axios from 'axios';
import { getKisAccessToken } from './kisClient';
import { KIS_BASE_URL, ENV } from './env';

/**
 * KIS 분봉(당일) 데이터 조회
 * @param symbol 종목코드 6자리 (예: "005930")
 * @param interval 분 간격 (문서의 파라미터 조건에 맞게 사용. 여기선 1분 단위 기본)
 * @param mrkt J(주식/ETF/ETN), W(ELW)
 * @param trId 문서상의 TR_ID (기본 예시)
 */
export async function fetchIntradayCandles(
  symbol: string,
  interval = 1,
  mrkt = 'J',
  trId = 'FHKST03010200'
) {
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
      // 필요 시 분봉 간격/범위 파라미터를 문서에 맞춰 추가하세요.
      // 일부 샘플 계정은 기본값으로 당일 전체 분봉을 내려주기도 합니다.
    },
  });

  // KIS 응답 포맷에 맞게 필요한 필드를 정리 (아래는 예시 형태)
  // data.output1 or output?.map(...) 등 실제 키는 계정/문서 버전에 따라 다를 수 있습니다.
  const rows = (data?.output || data?.output1 || data?.chart || []).map(
    (row: any) => ({
      // HHMMSS 혹은 yyyymmddHHMM 등
      t: row?.stck_cntg_hour || row?.t, // 시각
      o: Number(row?.stck_oprc ?? row?.o), // 시가
      h: Number(row?.stck_hgpr ?? row?.h), // 고가
      l: Number(row?.stck_lwpr ?? row?.l), // 저가
      c: Number(row?.stck_prpr ?? row?.c), // 종가(현재가)
      v: Number(row?.acml_tr_pbmn ?? row?.v), // 거래량(해당 봉)
    })
  );

  return rows;
}

/** (선택) 당일 기준가/전일종가 등 간단 시세 */
export async function fetchQuote(
  symbol: string,
  mrkt = 'J',
  trId = 'FHKST01010100'
) {
  const token = await getKisAccessToken();
  const url = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price`;

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
    },
  });

  // 실제 응답 키에 맞춰 조정 필요
  const out = data?.output || data;
  return {
    symbol,
    price: Number(out?.stck_prpr ?? out?.price),
    prevClose: Number(out?.stck_prdy_clpr ?? out?.prevClose),
    open: Number(out?.stck_oprc ?? out?.open),
  };
}
