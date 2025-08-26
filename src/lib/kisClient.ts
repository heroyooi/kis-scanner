import axios from 'axios';
import { addMinutes, isBefore } from 'date-fns';
import { KIS_BASE_URL, ENV } from './env';
import { initFirebaseAdmin } from './firebaseAdmin';

type TokenDoc = {
  access_token: string;
  expired_at: string; // ISO
};

const COLLECTION = 'secrets';
const DOC_ID = 'kisToken';

export async function getKisAccessToken(): Promise<string> {
  const { db } = initFirebaseAdmin();
  const ref = db.collection(COLLECTION).doc(DOC_ID);
  const snap = await ref.get();

  // 1) 캐시 유효하면 반환
  if (snap.exists) {
    const data = snap.data() as TokenDoc;
    if (data?.access_token && data?.expired_at) {
      if (isBefore(new Date(), new Date(data.expired_at))) {
        return data.access_token;
      }
    }
  }

  // 2) 신규 발급
  const path = ENV.KIS_PAPER === 'true' ? '/oauth2/tokenP' : '/oauth2/token';
  const url = `${KIS_BASE_URL}${path}`;

  // ✅ 폼 인코딩으로 보냅니다
  const form = new URLSearchParams({
    grant_type: 'client_credentials',
    appkey: ENV.KIS_APPKEY,
    appsecret: ENV.KIS_APPSECRET,
  });

  const { data } = await axios.post(url, form.toString(), {
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
  });

  const accessToken: string = data?.access_token;
  if (!accessToken) throw new Error('KIS access_token 발급 실패');

  // 일반(개인) 환경에선 토큰 유효기간이 1일로 안내됩니다.
  // 보수적으로 23시간으로 설정해 만료 이전 재발급 여유를 둡니다.
  const expiredAt = addMinutes(new Date(), 23 * 60).toISOString();

  await ref.set({
    access_token: accessToken,
    expired_at: expiredAt,
  });

  return accessToken;
}
