'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '../../components/layout/header';
import { useAuthContext } from '@/context/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldAlert } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, token, loading } = useAuthContext();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (!token || !user) {
      router.push('/login');
      return;
    }

    if (user.role !== 'admin') {
      setIsAuthorized(false);
      return;
    }

    setIsAuthorized(true);
  }, [user, token, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
        </div>
        <div className="container mx-auto px-4 py-8">
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="flex-1">
          <div className="container max-w-screen-xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-2xl bg-destructive/10 flex items-center justify-center mb-6">
                <ShieldAlert className="h-10 w-10 text-destructive" />
              </div>
              <h1 className="text-2xl font-display font-bold text-foreground mb-3">
                Acesso Negado
              </h1>
              <p className="text-muted-foreground max-w-md">
                Você não tem permissão para acessar esta página. Esta área é restrita apenas para administradores.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="flex-1">{children}</main>
    </div>
  );
}

