'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import styles from './Header.module.scss';

export default function Header() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  const nickname =
    user?.displayName ?? (user?.email ? user.email.split('@')[0] : '회원');

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <h1 className={styles.logo}>
          <Link href='/'>KIS 급등주</Link>
        </h1>
        <nav className={styles.nav}>
          {loading ? (
            <span style={{ opacity: 0 }}>loading</span>
          ) : user ? (
            <div className={styles.authArea}>
              <span className={styles.greeting}>{nickname}님 반갑습니다.</span>
              <button onClick={handleLogout} className={styles.logout}>
                로그아웃
              </button>
            </div>
          ) : (
            <div className={styles.authArea}>
              <Link href='/login' className={styles.login}>
                로그인
              </Link>
              <Link href='/signup' className={styles.signup}>
                회원가입
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
