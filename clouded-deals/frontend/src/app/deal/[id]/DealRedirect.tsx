'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function DealRedirect({ url }: { url: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(url);
  }, [router, url]);
  return null;
}
