'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { mergeAnonData } from '@/lib/auth';
import { Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState('Signing you in...');

  useEffect(() => {
    let mounted = true;

    async function handleCallback() {
      const client = supabase;
      if (!client?.auth) {
        if (mounted) router.push('/');
        return;
      }

      // Exchange the code from URL for a session
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');

      if (code) {
        const { data, error } = await client.auth.exchangeCodeForSession(code);

        if (error) {
          if (mounted) {
            setStatus('Something went wrong. Redirecting...');
            setTimeout(() => router.push('/?auth=error'), 2000);
          }
          return;
        }

        if (data?.user) {
          if (mounted) setStatus('Syncing your saved deals...');
          await mergeAnonData(data.user.id);
        }

        if (mounted) router.push('/?auth=success');
        return;
      }

      // No code param — check if there's a hash-based token (implicit flow fallback)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');

      if (accessToken) {
        const { data } = await client.auth.getUser(accessToken);
        if (data?.user) {
          if (mounted) setStatus('Syncing your saved deals...');
          await mergeAnonData(data.user.id);
        }
        if (mounted) router.push('/?auth=success');
        return;
      }

      // Nothing to process — redirect home
      if (mounted) router.push('/');
    }

    handleCallback();

    // Safety timeout — always redirect after 15s
    const timeout = setTimeout(() => {
      if (mounted) router.push('/');
    }, 15000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-4" />
        <p className="text-sm text-slate-400">{status}</p>
      </div>
    </div>
  );
}
