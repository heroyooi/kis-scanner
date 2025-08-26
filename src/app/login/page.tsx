'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  onIdTokenChanged,
  getIdToken,
} from 'firebase/auth';
import { authClient } from '@/lib/firebase.client';
import styles from './login.module.scss';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 로그인 상태면 바로 /admin/scans
  useEffect(() => {
    const unsub = onIdTokenChanged(authClient, async (u) => {
      if (u) {
        // 토큰 미리 확보(선택)
        await getIdToken(u, false);
        router.replace('/admin/scans');
      }
    });
    return () => unsub();
  }, [router]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await signInWithEmailAndPassword(authClient, email.trim(), pw);
      // onIdTokenChanged에서 라우팅 처리됨
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : '로그인 실패');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setErr(null);
    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(authClient, provider);
      // onIdTokenChanged에서 라우팅 처리됨
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : 'Google 로그인 실패');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1>관리자 로그인</h1>

        <form onSubmit={handleEmailLogin} className={styles.form}>
          <label>
            <span>이메일</span>
            <input
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder='you@example.com'
            />
          </label>

          <label>
            <span>비밀번호</span>
            <input
              type='password'
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              required
              placeholder='••••••••'
            />
          </label>

          {err && <p className={styles.error}>{err}</p>}

          <button type='submit' disabled={busy} className={styles.primary}>
            {busy ? '처리 중…' : '이메일로 로그인'}
          </button>
        </form>

        <div className={styles.divider}>
          <span>또는</span>
        </div>

        <button
          onClick={handleGoogle}
          disabled={busy}
          className={styles.google}
        >
          Google로 로그인
        </button>
      </div>
    </div>
  );
}
