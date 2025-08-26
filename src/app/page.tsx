'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import styles from './page.module.css';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace('/admin/scans');
    } else {
      router.replace('/login');
    }
  }, [user, loading, router]);

  // 로딩 중 or 라우팅 중엔 빈 화면/스피너
  return <div className={styles.page}>처리 중…</div>;
}
