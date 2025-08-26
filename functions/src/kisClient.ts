// Node 18+ 전역 fetch 사용 (node-fetch 불필요)
export type Quote = {
  symbol: string;
  price: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number; // 1분 거래량
  value: number; // 1분 거래대금(원)
  halted?: boolean;
  viTriggered?: boolean;
};

let accessToken = '';
let tokenExp = 0;

export async function getToken(): Promise<string> {
  const now = Date.now();

  // 만료 1분 전까진 기존 토큰 재사용
  if (accessToken && now < tokenExp - 60_000) {
    return accessToken;
  }

  const res = await fetch(
    'https://openapi.koreainvestment.com:9443/oauth2/tokenP',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        appkey: process.env.KIS_APPKEY, // 환경변수에 넣어둔 값
        appsecret: process.env.KIS_APPSECRET, // 환경변수에 넣어둔 값
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Token request failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    token_type: string;
    expires_in: number;
  };

  if (!data.access_token) {
    throw new Error(`Token response invalid: ${JSON.stringify(data)}`);
  }

  accessToken = data.access_token;
  tokenExp = now + data.expires_in * 1000; // 보통 86400초 (24시간)

  return accessToken;
}

export async function getMinuteQuotes(symbols: string[]): Promise<Quote[]> {
  await getToken(); // 필요 시 토큰 갱신
  // TODO: 실제 API 호출로 교체
  // 레이트리밋 고려하여 배치/동시성 제한 필요
  return symbols.map((s) => ({
    symbol: s,
    price: 70000,
    open: 69900,
    high: 70500,
    low: 69500,
    close: 70000,
    volume: 120_000,
    value: 120_000 * 70000,
    halted: false,
    viTriggered: false,
  }));
}
