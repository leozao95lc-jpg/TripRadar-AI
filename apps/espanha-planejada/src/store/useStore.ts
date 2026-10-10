// Estado global com persistência em localStorage.
// Os dados ficam APENAS neste navegador: não há backup nem sincronização automática.
// Use "Exportar backup" para guardar uma cópia em arquivo.

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { uid } from '../lib/id';
import { DEFAULT_SETTINGS, newClient } from '../domain/templates';
import type { Client, ProfileKind, Scenario, Settings } from '../domain/types';

export const STORAGE_KEY = 'espanha-planejada:v1';

export interface BackupFile {
  app: 'espanha-planejada';
  version: 1;
  exportedAt: string;
  settings: Settings;
  clients: Client[];
}

interface State {
  clients: Client[];
  settings: Settings;
  createClient: (profile: ProfileKind) => string;
  addClients: (clients: Client[]) => void;
  mutateClient: (id: string, fn: (draft: Client) => void) => void;
  deleteClient: (id: string) => void;
  duplicateClient: (id: string) => string | null;
  updateSettings: (patch: Partial<Settings>) => void;
  importBackup: (data: BackupFile, mode: 'substituir' | 'mesclar') => void;
  resetAll: () => void;
}

function clone<T>(v: T): T {
  return structuredClone(v);
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      clients: [],
      settings: DEFAULT_SETTINGS,

      createClient: (profile) => {
        const c = newClient(profile, get().settings);
        set((s) => ({ clients: [c, ...s.clients] }));
        return c.id;
      },

      addClients: (clients) => set((s) => ({ clients: [...clients, ...s.clients] })),

      mutateClient: (id, fn) =>
        set((s) => ({
          clients: s.clients.map((c) => {
            if (c.id !== id) return c;
            const draft = clone(c);
            fn(draft);
            draft.updatedAt = new Date().toISOString();
            return draft;
          }),
        })),

      deleteClient: (id) => set((s) => ({ clients: s.clients.filter((c) => c.id !== id) })),

      duplicateClient: (id) => {
        const src = get().clients.find((c) => c.id === id);
        if (!src) return null;
        const copy = clone(src);
        const now = new Date().toISOString();
        copy.id = uid('cl');
        copy.createdAt = now;
        copy.updatedAt = now;
        copy.status = 'rascunho';
        copy.deliveries = [];
        copy.personal.name = `${src.personal.name || 'Cliente'} (cópia)`;
        const idMap = new Map<string, string>();
        copy.scenarios = copy.scenarios.map((sc) => {
          const nid = uid('sc');
          idMap.set(sc.id, nid);
          return { ...sc, id: nid };
        });
        copy.selectedScenarioId = idMap.get(src.selectedScenarioId) ?? copy.scenarios[0]?.id ?? '';
        set((s) => ({ clients: [copy, ...s.clients] }));
        return copy.id;
      },

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      importBackup: (data, mode) =>
        set((s) => {
          const settings = { ...DEFAULT_SETTINGS, ...data.settings };
          if (mode === 'substituir') return { clients: data.clients, settings };
          const existing = new Set(s.clients.map((c) => c.id));
          const incoming = data.clients.map((c) => (existing.has(c.id) ? { ...c, id: uid('cl') } : c));
          return { clients: [...incoming, ...s.clients] };
        }),

      resetAll: () => set({ clients: [], settings: DEFAULT_SETTINGS }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ clients: s.clients, settings: s.settings }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return {
          ...current,
          clients: Array.isArray(p.clients) ? p.clients : [],
          settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) },
        };
      },
    },
  ),
);

export function useClient(id: string | undefined): Client | undefined {
  return useStore((s) => s.clients.find((c) => c.id === id));
}

/** Validação mínima de um arquivo de backup antes de importar. */
export function parseBackup(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('O arquivo não é um JSON válido.');
  }
  const d = data as Partial<BackupFile>;
  if (d?.app !== 'espanha-planejada' || d.version !== 1 || !Array.isArray(d.clients)) {
    throw new Error('O arquivo não é um backup do Espanha Planejada (versão 1).');
  }
  for (const c of d.clients) {
    if (!c || typeof c.id !== 'string' || !c.personal || !c.finances || !Array.isArray(c.scenarios) || c.scenarios.length === 0) {
      throw new Error('Backup com cliente incompleto ou corrompido. Nada foi importado.');
    }
  }
  return d as BackupFile;
}

export function buildBackup(clients: Client[], settings: Settings): BackupFile {
  return { app: 'espanha-planejada', version: 1, exportedAt: new Date().toISOString(), settings, clients };
}

export function duplicateScenario(sc: Scenario, name?: string): Scenario {
  const copy = clone(sc);
  copy.id = uid('sc');
  copy.name = name ?? `${sc.name} (cópia)`;
  copy.level = 'personalizado';
  copy.oneTimeCosts = copy.oneTimeCosts.map((c) => ({ ...c, id: uid('ot') }));
  copy.monthlyCosts = copy.monthlyCosts.map((c) => ({ ...c, id: uid('mc') }));
  copy.updatedAt = new Date().toISOString();
  return copy;
}
