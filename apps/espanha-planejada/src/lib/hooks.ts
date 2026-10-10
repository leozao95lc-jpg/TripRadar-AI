import { useMemo } from 'react';
import { analyze, type Analysis } from '../domain/analysis';
import type { Client } from '../domain/types';
import { useStore } from '../store/useStore';
import { todayISO } from './dates';

export function useToday(): string {
  return useMemo(() => todayISO(), []);
}

export function useAnalysis(client: Client | undefined): Analysis | null {
  const settings = useStore((s) => s.settings);
  const today = useToday();
  return useMemo(() => (client ? analyze(client, settings, today) : null), [client, settings, today]);
}
