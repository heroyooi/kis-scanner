import { z } from 'zod';

const envSchema = z.object({
  KIS_APPKEY: z.string().min(10),
  KIS_APPSECRET: z.string().min(10),
  KIS_PAPER: z.string().default('true'),
  FIREBASE_PROJECT_ID: z.string(),
  FIREBASE_CLIENT_EMAIL: z.string(),
  FIREBASE_PRIVATE_KEY: z.string(),
});

export const ENV = envSchema.parse({
  KIS_APPKEY: process.env.KIS_APPKEY,
  KIS_APPSECRET: process.env.KIS_APPSECRET,
  KIS_PAPER: process.env.KIS_PAPER,
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
});

export const KIS_BASE_URL =
  ENV.KIS_PAPER === 'true'
    ? 'https://openapivts.koreainvestment.com:29443'
    : 'https://openapi.koreainvestment.com:9443';
