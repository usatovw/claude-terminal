"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

export interface Provider {
  id: number;
  name: string;
  slug: string;
  command: string;
  resume_command: string | null;
  icon: string;
  color: string;
  sort_order: number;
  is_builtin: number;
  created_at: string;
}

interface ProviderContextValue {
  providers: Provider[];
  loading: boolean;
  refetch: () => Promise<void>;
  getBySlug: (slug: string) => Provider | undefined;
}

const ProviderContext = createContext<ProviderContextValue>({
  providers: [],
  loading: true,
  refetch: async () => {},
  getBySlug: () => undefined,
});

export function useProviders() {
  return useContext(ProviderContext);
}

export function ProviderProvider({ children }: { children: React.ReactNode }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/providers");
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const getBySlug = useCallback(
    (slug: string) => providers.find((p) => p.slug === slug),
    [providers]
  );

  return (
    <ProviderContext.Provider value={{ providers, loading, refetch, getBySlug }}>
      {children}
    </ProviderContext.Provider>
  );
}
