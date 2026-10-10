import { Copy, Download, FileUp, Plus, Sparkles, Trash2, User, Users, Baby, HardDrive } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, Modal, ProgressBar } from '../components/ui';
import { analyze } from '../domain/analysis';
import { CLIENT_STATUS_LABELS, PROFILE_LABELS } from '../domain/labels';
import type { ProfileKind } from '../domain/types';
import { monthLabel, todayISO } from '../lib/dates';
import { buildDemoClients } from '../lib/demo';
import { downloadText } from '../lib/download';
import { money, pct } from '../lib/format';
import { buildBackup, parseBackup, useStore, type BackupFile } from '../store/useStore';

const PROFILE_OPTIONS: { value: ProfileKind; icon: typeof User; text: string }[] = [
  { value: 'sozinho', icon: User, text: 'Uma pessoa: passagens, moradia, custo de vida e reserva individual.' },
  { value: 'casal', icon: Users, text: 'Duas pessoas, com despesas compartilhadas e individuais.' },
  { value: 'familia', icon: Baby, text: 'Adultos e crianças, com educação e necessidades adicionais.' },
];

export default function ClientsPage() {
  const { clients, settings, createClient, addClients, deleteClient, duplicateClient, importBackup } = useStore();
  const navigate = useNavigate();
  const [newOpen, setNewOpen] = useState(false);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<BackupFile | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const today = todayISO();

  const rows = useMemo(
    () =>
      clients
        .filter((c) => {
          const q = query.trim().toLowerCase();
          return !q || c.personal.name.toLowerCase().includes(q) || c.move.targetCity.toLowerCase().includes(q);
        })
        .map((c) => ({ client: c, a: analyze(c, settings, today) })),
    [clients, settings, today, query],
  );

  const onFile = async (file: File) => {
    setImportError(null);
    try {
      setPendingImport(parseBackup(await file.text()));
    } catch (e) {
      setImportError((e as Error).message);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">Clientes</h1>
          <p className="text-sm text-navy-500">Cadastre clientes, simule cenários e gere o planejamento de cada mudança.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => fileRef.current?.click()}>
            <FileUp className="h-4 w-4" /> Importar backup
          </Button>
          <Button
            onClick={() => downloadText(`espanha-planejada-backup-${today}.json`, JSON.stringify(buildBackup(clients, settings), null, 2), 'application/json')}
            disabled={clients.length === 0}
          >
            <Download className="h-4 w-4" /> Exportar backup
          </Button>
          <Button variant="primary" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" /> Novo cliente
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = '';
          }}
        />
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-navy-100 bg-navy-50 px-4 py-3 text-xs leading-relaxed text-navy-700">
        <HardDrive className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Os dados ficam salvos <strong>apenas neste navegador</strong> (armazenamento local). Não há backup automático nem sincronização entre
          computadores: limpar os dados do navegador apaga os clientes. Use <strong>Exportar backup</strong> ao fim de cada atendimento. Não há
          login — não use esta versão em computadores compartilhados.
        </p>
      </div>
      {importError && <p className="mt-3 rounded-lg bg-terra-50 px-3 py-2 text-sm text-terra-700">{importError}</p>}

      {clients.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Nenhum cliente cadastrado"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" onClick={() => setNewOpen(true)}>
                  <Plus className="h-4 w-4" /> Cadastrar cliente
                </Button>
                <Button onClick={() => addClients(buildDemoClients(settings))}>
                  <Sparkles className="h-4 w-4" /> Carregar 3 exemplos
                </Button>
              </div>
            }
          >
            Comece cadastrando um cliente ou carregue os exemplos (pessoa sozinha, casal e família) para conhecer a ferramenta.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou cidade"
              className="w-full max-w-xs rounded-lg border border-areia-300 bg-white px-3 py-2 text-sm focus:border-verde-500 focus:outline-none"
            />
            <Button variant="ghost" size="sm" onClick={() => addClients(buildDemoClients(settings))}>
              <Sparkles className="h-3.5 w-3.5" /> Adicionar exemplos
            </Button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map(({ client: c, a }) => {
              const critical = a.alerts.filter((x) => x.severity === 'critico').length;
              return (
                <Card key={c.id} className="flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link to={`/clientes/${c.id}`} className="block truncate font-semibold text-navy-900 hover:text-verde-700">
                        {c.personal.name || 'Cliente sem nome'}
                      </Link>
                      <p className="mt-0.5 text-xs text-navy-500">
                        {PROFILE_LABELS[c.profile]} · {c.move.targetCity || 'cidade a definir'} · {monthLabel(c.move.targetMonth)}
                      </p>
                    </div>
                    <Badge tone={c.status === 'entregue' ? 'green' : c.status === 'em_andamento' ? 'navy' : 'neutral'}>{CLIENT_STATUS_LABELS[c.status]}</Badge>
                  </div>
                  {a.plan.valid ? (
                    <div className="mt-4">
                      <div className="flex items-baseline justify-between text-xs text-navy-500">
                        <span>Meta: {money(a.plan.main.required.totalBRL)}</span>
                        <span>{pct(a.plan.main.progressPct)}</span>
                      </div>
                      <ProgressBar value={a.plan.main.progressPct} className="mt-1.5" />
                      <p className="mt-2 text-sm">
                        {a.plan.main.shortfallBRL > 0 ? (
                          <>
                            Faltam <strong className="tabular-nums">{money(a.plan.main.shortfallBRL)}</strong>
                          </>
                        ) : (
                          <span className="text-verde-700">Meta matemática atingida</span>
                        )}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-terra-700">{a.plan.blockers[0]}</p>
                  )}
                  <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                    {critical > 0 ? <Badge tone="danger">{critical} alerta(s) crítico(s)</Badge> : <span />}
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" title="Duplicar" onClick={() => duplicateClient(c.id)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" title="Excluir" onClick={() => setToDelete(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="primary" onClick={() => navigate(`/clientes/${c.id}`)}>
                        Abrir
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Novo cliente — escolha o perfil inicial">
        <p className="mb-3 text-sm text-navy-500">O perfil define os cenários-modelo iniciais. Tudo pode ser personalizado depois.</p>
        <div className="flex flex-col gap-2">
          {PROFILE_OPTIONS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => {
                const id = createClient(p.value);
                setNewOpen(false);
                navigate(`/clientes/${id}?aba=cadastro`);
              }}
              className="flex items-start gap-3 rounded-xl border border-areia-200 p-3 text-left transition hover:border-verde-400 hover:bg-verde-50"
            >
              <p.icon className="mt-0.5 h-5 w-5 text-verde-600" />
              <span>
                <span className="block font-medium text-navy-900">{PROFILE_LABELS[p.value]}</span>
                <span className="block text-xs text-navy-500">{p.text}</span>
              </span>
            </button>
          ))}
        </div>
      </Modal>

      <Modal
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Excluir cliente?"
        footer={
          <>
            <Button onClick={() => setToDelete(null)}>Cancelar</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (toDelete) deleteClient(toDelete);
                setToDelete(null);
              }}
            >
              Excluir definitivamente
            </Button>
          </>
        }
      >
        <p className="text-sm text-navy-600">Esta ação não pode ser desfeita. Se precisar, exporte um backup antes.</p>
      </Modal>

      <Modal
        open={pendingImport !== null}
        onClose={() => setPendingImport(null)}
        title="Importar backup"
        footer={
          <>
            <Button onClick={() => setPendingImport(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (pendingImport) importBackup(pendingImport, 'mesclar');
                setPendingImport(null);
              }}
            >
              Adicionar aos atuais
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (pendingImport) importBackup(pendingImport, 'substituir');
                setPendingImport(null);
              }}
            >
              Substituir tudo
            </Button>
          </>
        }
      >
        {pendingImport && (
          <p className="text-sm text-navy-600">
            Backup de {new Date(pendingImport.exportedAt).toLocaleString('pt-BR')} com {pendingImport.clients.length} cliente(s). “Substituir tudo” apaga os
            clientes atuais deste navegador e também restaura as configurações do backup.
          </p>
        )}
      </Modal>
    </div>
  );
}
