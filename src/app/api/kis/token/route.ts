import { NextResponse } from 'next/server';
import axios, { AxiosError } from 'axios';
import { KIS_BASE_URL, ENV } from '@/lib/env';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const url = `${KIS_BASE_URL}${
      ENV.KIS_PAPER === 'true' ? '/oauth2/tokenP' : '/oauth2/token'
    }`;

    const form = new URLSearchParams({
      grant_type: 'client_credentials',
      appkey: process.env.KIS_APPKEY!,
      appsecret: process.env.KIS_APPSECRET!,
    });

    const { data } = await axios.post(url, form.toString(), {
      headers: {
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
    });

    return NextResponse.json({
      ok: true,
      preview: String(data?.access_token).slice(0, 12) + '...',
    });
  } catch (err) {
    const e = err as AxiosError;

    return NextResponse.json(
      {
        ok: false,
        status: e.response?.status,
        data: e.response?.data,
        message: e.message,
      },
      { status: 500 }
    );
  }
}
