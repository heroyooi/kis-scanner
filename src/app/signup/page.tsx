'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  onIdTokenChanged,
  getIdToken,
} from 'firebase/auth';
import { authClient } from '@/lib/firebase.client';
// 기존 로그인 스타일 재사용: 필요 시 signup.module.scss로 교체하세요.
import styles from '@/app/login/login.module.scss';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 로그인(=가입 직후 자동 로그인 포함) 상태면 바로 /admin/scans
  useEffect(() => {
    const unsub = onIdTokenChanged(authClient, async (u) => {
      if (u) {
        await getIdToken(u, false);
        router.replace('/admin/scans');
      }
    });
    return () => unsub();
  }, [router]);

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr(null);

    // 간단한 클라이언트 유효성 검사
    if (pw.length < 6) {
      setErr('비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    if (pw !== pw2) {
      setErr('비밀번호가 일치하지 않습니다.');
      return;
    }

    setBusy(true);
    try {
      await createUserWithEmailAndPassword(authClient, email.trim(), pw);
      // onIdTokenChanged에서 라우팅 처리
      // (이메일 인증을 쓰시려면 여기서 sendEmailVerification(u) 추가 가능)
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : '회원가입 실패');
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
      // onIdTokenChanged에서 라우팅 처리
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : 'Google 가입 실패');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1>회원가입</h1>

        <form onSubmit={handleSignup} className={styles.form}>
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

          <label>
            <span>비밀번호 확인</span>
            <input
              type='password'
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              required
              placeholder='••••••••'
            />
          </label>

          {err && <p className={styles.error}>{err}</p>}

          <button type='submit' disabled={busy} className={styles.primary}>
            {busy ? '처리 중…' : '이메일로 가입'}
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
          Google로 계속하기
        </button>
      </div>
    </div>
  );
}
