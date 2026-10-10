import { ArrowLeft, ClipboardCheck, ClipboardList, Eye, FileText, Gauge, Layers, NotebookPen, PiggyBank, UserRound } from 'lucide-react';
import { useCallback } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import ChecklistEditor from '../components/ChecklistEditor';
import ClientForm from '../components/ClientForm';
import Dashboard from '../components/Dashboard';
import DeliveryPanel from '../components/DeliveryPanel';
import NotesEditor from '../components/NotesEditor';
import SavingsPlanEditor from '../components/SavingsPlanEditor';
import ScenarioEditor from '../components/ScenarioEditor';
import { Badge, EmptyState, Select, Tabs } from '../components/ui';
import { CLIENT_STATUS_LABELS, LEVEL_LABELS, PROFILE_LABELS } from '../domain/labels';
import type { Client, ClientStatus } from '../domain/types';
import { useAnalysis } from '../lib/hooks';
import { useClient, useStore } from '../store/useStore';

type Tab = 'painel' | 'cadastro' | 'cenarios' | 'poupanca' | 'checklist' | 'anotacoes' | 'entrega';

const TABS: { value: Tab; label: string; icon: React.ReactNode }[] = [
  { value: 'painel', label: 'Painel', icon: <Gauge className="h-4 w-4" /> },
  { value: 'cadastro', label: 'Cadastro', icon: <UserRound className="h-4 w-4" /> },
  { value: 'cenarios', label: 'Cenários e custos', icon: <Layers className="h-4 w-4" /> },
  { value: 'poupanca', label: 'Plano de poupança', icon: <PiggyBank className="h-4 w-4" /> },
  { value: 'checklist', label: 'Checklist', icon: <ClipboardCheck className="h-4 w-4" /> },
  { value: 'anotacoes', label: 'Anotações', icon: <NotebookPen className="h-4 w-4" /> },
  { value: 'entrega', label: 'Entrega', icon: <ClipboardList className="h-4 w-4" /> },
];

export type Mutate = (fn: (draft: Client) => void) => void;

export default function ClientWorkspace() {
  const { id } = useParams();
  const client = useClient(id);
  const mutateClient = useStore((s) => s.mutateClient);
  const [params, setParams] = useSearchParams();
  const tab = (TABS.some((t) => t.value === params.get('aba')) ? params.get('aba') : 'painel') as Tab;
  const analysis = useAnalysis(client);

  const mutate: Mutate = useCallback((fn) => id && mutateClient(id, fn), [id, mutateClient]);

  if (!client || !analysis) {
    return (
      <EmptyState title="Cliente não encontrado" action={<Link to="/" className="text-sm font-medium text-verde-700">Voltar para a lista</Link>}>
        Ele pode ter sido excluído ou estar salvo em outro navegador.
      </EmptyState>
    );
  }

  const setTab = (t: Tab) => setParams({ aba: t }, { replace: true });

  return (
    <div className="mx-auto max-w-6xl">
      <Link to="/" className="no-print inline-flex items-center gap-1 text-xs font-medium text-navy-500 hover:text-navy-800">
        <ArrowLeft className="h-3.5 w-3.5" /> Clientes
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold text-navy-900">{client.personal.name || 'Cliente sem nome'}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-navy-500">
            <Badge tone="navy">{PROFILE_LABELS[client.profile]}</Badge>
            <span>{client.move.targetCity || 'Cidade a definir'}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-navy-500">
            Cenário em análise
            <Select
              className="mt-1 min-w-44"
              value={client.selectedScenarioId}
              onChange={(v) => mutate((d) => void (d.selectedScenarioId = v))}
              options={client.scenarios.map((s) => ({ value: s.id, label: `${s.name}${s.level !== 'personalizado' && s.name !== LEVEL_LABELS[s.level] ? ` (${LEVEL_LABELS[s.level]})` : ''}` }))}
            />
          </label>
          <label className="text-xs text-navy-500">
            Status
            <Select<ClientStatus>
              className="mt-1"
              value={client.status}
              onChange={(v) => mutate((d) => void (d.status = v))}
              options={(Object.keys(CLIENT_STATUS_LABELS) as ClientStatus[]).map((s) => ({ value: s, label: CLIENT_STATUS_LABELS[s] }))}
            />
          </label>
          <Link
            to={`/plano/${client.id}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg border border-areia-300 bg-white px-3.5 py-2 text-sm font-medium text-navy-800 hover:bg-areia-50"
          >
            <Eye className="h-4 w-4" /> Visão do cliente
          </Link>
          <Link
            to={`/clientes/${client.id}/relatorio`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg bg-navy-800 px-3.5 py-2 text-sm font-medium text-white hover:bg-navy-700"
          >
            <FileText className="h-4 w-4" /> Relatório
          </Link>
        </div>
      </div>

      <div className="mt-5">
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
      </div>

      <div className="mt-6">
        {tab === 'painel' && <Dashboard client={client} analysis={analysis} onNavigate={(t) => setTab(t as Tab)} />}
        {tab === 'cadastro' && <ClientForm client={client} mutate={mutate} onDone={() => setTab('painel')} />}
        {tab === 'cenarios' && <ScenarioEditor client={client} mutate={mutate} analysis={analysis} />}
        {tab === 'poupanca' && <SavingsPlanEditor client={client} mutate={mutate} analysis={analysis} />}
        {tab === 'checklist' && <ChecklistEditor client={client} mutate={mutate} />}
        {tab === 'anotacoes' && <NotesEditor client={client} mutate={mutate} />}
        {tab === 'entrega' && <DeliveryPanel client={client} mutate={mutate} analysis={analysis} />}
      </div>
    </div>
  );
}
