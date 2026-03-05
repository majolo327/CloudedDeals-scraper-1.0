'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AnalyticsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/admin'); }, [router]);
  return (
    <div className="p-8 text-center text-zinc-400 dark:text-zinc-500">
      Redirecting to Dashboard...
    </div>
  );
}
