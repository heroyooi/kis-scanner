'use client';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { authClient } from '@/lib/firebase.client';
import styles from './AdminHeader.module.scss';

export default function AdminHeader() {
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(authClient);
    router.push('/login');
  };

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <h1 className={styles.logo}>관리자 대시보드</h1>
        <nav className={styles.nav}>
          <button onClick={handleLogout} className={styles.logout}>
            로그아웃
          </button>
        </nav>
      </div>
    </header>
  );
}
