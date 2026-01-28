'use client';

import { useState, useEffect } from 'react';
import { InstancesGrid } from '../components/instances-grid';
import { DashboardHeader } from '../components/dashboard-header';
import { useAuthContext } from '@/context/AuthContext';

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
        console.error('Failed to fetch instances:', data);
        return Array.isArray(data) ? data : [];
      }

      console.log('Fetched instances from backend:', data);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error fetching instances:', error);
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
      <div className="container max-w-screen-lg mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading instances...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-screen-lg mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <DashboardHeader hasInstances={instances.length > 0} onRefresh={refreshInstances} />

      {instances.length > 0 ? (
        <InstancesGrid items={instances} onRefresh={refreshInstances} />
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-center py-20 animate-fade-in">
          <h2 className="text-xl font-semibold text-foreground mb-2">No active instances</h2>
          <p className="text-muted-foreground mb-4 max-w-sm">
            There are no active instances. Connect one to get started.
          </p>
        </div>
      )}
    </div>
  );
}
