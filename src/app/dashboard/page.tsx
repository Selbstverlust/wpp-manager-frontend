'use client';

import { useState, useEffect } from 'react';
import { InstancesGrid } from '../components/instances-grid';
import { DashboardHeader } from '../components/dashboard-header';
import { useAuthContext } from '@/context/AuthContext';
import { Bot, Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { token } = useAuthContext();

  async function fetchInstancesFromApi(): Promise<any[]> {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL;

    if (!backendUrl || !token) {
      return [];
    }

    const url = `${backendUrl.replace(/\/$/, '')}/instances`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      const data = await response.json().catch(() => []);

      if (!response.ok) {
        console.error('Falha ao buscar instâncias:', data);
        return Array.isArray(data) ? data : [];
      }

      console.log('Instâncias obtidas do backend:', data);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Erro ao buscar instâncias:', error);
      return [];
    }
  }

  async function refreshInstances() {
    setLoading(true);
    const fetchedInstances = await fetchInstancesFromApi();
    setInstances(fetchedInstances);
    setLoading(false);
  }

  useEffect(() => {
    if (token) {
      refreshInstances();
    } else {
      setLoading(false);
    }
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="relative inline-flex">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-glow animate-pulse-ring">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            </div>
          </div>
          <p className="mt-6 text-muted-foreground font-medium">Carregando suas instâncias...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-background to-secondary/20">
      <div className="container max-w-screen-xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <DashboardHeader hasInstances={instances.length > 0} onRefresh={refreshInstances} />

        {instances.length > 0 ? (
          <InstancesGrid items={instances} onRefresh={refreshInstances} />
        ) : (
          <div className="mt-8 animate-fade-in-up">
            <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-border/60 bg-card/50 backdrop-blur-sm">
              {/* Fundo decorativo */}
              <div className="absolute inset-0 pattern-dots opacity-30" />
              
              <div className="relative flex flex-col items-center justify-center text-center py-20 px-6">
                <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center shadow-glow mb-6">
                  <Bot className="h-10 w-10 text-white" />
                </div>
                
                <h2 className="text-2xl font-display font-bold text-foreground mb-3">
                  Nenhuma instância ativa
                </h2>
                <p className="text-muted-foreground mb-6 max-w-sm text-base">
                  Comece conectando sua primeira instância do WhatsApp para gerenciar seus bots.
                </p>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground/70">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span>Clique em "Conectar Nova Instância" para começar</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
