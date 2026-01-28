'use client';

import { Header } from '../../components/layout/header';
import { useProtectedRoute } from '../../hooks/useProtectedRoute';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const isReady = useProtectedRoute();

  if (!isReady) {
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
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
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
