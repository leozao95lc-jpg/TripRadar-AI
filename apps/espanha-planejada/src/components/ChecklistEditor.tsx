import { Plus, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { CHECKLIST_STATUS_LABELS } from '../domain/labels';
import { buildChecklist } from '../domain/templates';
import type { ChecklistItem, ChecklistStatus, Client } from '../domain/types';
import { uid } from '../lib/id';
import type { Mutate } from '../pages/ClientWorkspace';
import { Badge, Button, Card, Field, Modal, ProgressBar, Select, TextInput, cx } from './ui';

const STATUS_STYLE: Record<ChecklistStatus, string> = {
  pendente: 'border-areia-300 bg-white text-navy-700',
  em_andamento: 'border-amber-200 bg-amber-50 text-amber-800',
  concluida: 'border-verde-200 bg-verde-50 text-verde-700',
  nao_aplicavel: 'border-areia-200 bg-areia-100 text-navy-400',
};

export function checklistProgress(items: ChecklistItem[]): { done: number; total: number; pct: number } {
  const applicable = items.filter((i) => i.status !== 'nao_aplicavel');
  const done = applicable.filter((i) => i.status === 'concluida').length;
  return { done, total: applicable.length, pct: applicable.length ? (done / applicable.length) * 100 : 0 };
}

export default function ChecklistEditor({ client, mutate }: { client: Client; mutate: Mutate }) {
  const [filter, setFilter] = useState<'todas' | ChecklistStatus>('todas');
  const [resetOpen, setResetOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newGroup, setNewGroup] = useState('Outros');
  const groups = [...new Set(client.checklist.map((i) => i.group))];
  const prog = checklistProgress(client.checklist);
  const set = (id: string, patch: Partial<ChecklistItem>) => mutate((d) => void Object.assign(d.checklist.find((x) => x.id === id) ?? {}, patch));

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-56 flex-1">
            <p className="text-sm font-medium text-navy-800">
              {prog.done} de {prog.total} tarefas aplicáveis concluídas
            </p>
            <ProgressBar value={prog.pct} className="mt-2" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select
              value={filter}
              onChange={setFilter}
              options={[{ value: 'todas', label: 'Todas as tarefas' }, ...(Object.keys(CHECKLIST_STATUS_LABELS) as ChecklistStatus[]).map((k) => ({ value: k, label: CHECKLIST_STATUS_LABELS[k] }))]}
            />
            <Button size="sm" onClick={() => setResetOpen(true)}>
              <RefreshCw className="h-3.5 w-3.5" /> Regerar
            </Button>
          </div>
        </div>
        <p className="mt-3 flex gap-2 text-xs text-navy-500">
          <ShieldAlert className="h-4 w-4 shrink-0 text-navy-400" />
          Tarefas marcadas com “verificar em fonte oficial” dependem de requisitos migratórios. A ferramenta não define prazos legais: registre a data e a fonte
          consultada na observação.
        </p>
      </Card>

      {groups.map((g) => {
        const items = client.checklist.filter((i) => i.group === g && (filter === 'todas' || i.status === filter));
        if (items.length === 0) return null;
        return (
          <Card key={g} title={g}>
            <ul className="flex flex-col divide-y divide-areia-100">
              {items.map((i) => (
                <li key={i.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 md:flex-row md:items-start md:justify-between">
                  <div className={cx('min-w-0 flex-1', i.status === 'nao_aplicavel' && 'opacity-50', i.status === 'concluida' && 'line-through decoration-verde-400')}>
                    <p className="text-sm font-medium text-navy-900">{i.title}</p>
                    {i.detail && <p className="text-xs text-navy-500">{i.detail}</p>}
                    {i.requiresOfficialCheck && (
                      <Badge tone="warn" className="mt-1">
                        Verificar em fonte oficial
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:w-[440px] md:flex-nowrap">
                    <TextInput className="min-w-0 flex-1 text-xs" placeholder="Observação / fonte consultada" value={i.note} onChange={(e) => set(i.id, { note: e.target.value })} />
                    <input
                      type="date"
                      value={i.dueDate}
                      onChange={(e) => set(i.id, { dueDate: e.target.value })}
                      title="Data-alvo definida com o cliente"
                      className="rounded-lg border border-areia-300 px-2 py-2 text-xs"
                    />
                    <select
                      value={i.status}
                      onChange={(e) => set(i.id, { status: e.target.value as ChecklistStatus })}
                      className={cx('rounded-lg border px-2 py-2 text-xs font-medium', STATUS_STYLE[i.status])}
                    >
                      {(Object.keys(CHECKLIST_STATUS_LABELS) as ChecklistStatus[]).map((k) => (
                        <option key={k} value={k}>
                          {CHECKLIST_STATUS_LABELS[k]}
                        </option>
                      ))}
                    </select>
                    <button type="button" aria-label="Remover tarefa" className="rounded p-1.5 text-navy-300 hover:bg-areia-100 hover:text-terra-600" onClick={() => mutate((d) => void (d.checklist = d.checklist.filter((x) => x.id !== i.id)))}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}

      <Card title="Adicionar tarefa">
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_220px_auto]">
          <Field label="Tarefa">
            <TextInput value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Descreva a tarefa" />
          </Field>
          <Field label="Grupo">
            <TextInput value={newGroup} onChange={(e) => setNewGroup(e.target.value)} list="checklist-groups" />
            <datalist id="checklist-groups">
              {groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </Field>
          <Button
            variant="primary"
            disabled={!newTitle.trim()}
            onClick={() => {
              mutate((d) =>
                void d.checklist.push({ id: uid('ck'), group: newGroup.trim() || 'Outros', title: newTitle.trim(), detail: '', status: 'pendente', requiresOfficialCheck: false, dueDate: '', note: '' }),
              );
              setNewTitle('');
            }}
          >
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </div>
      </Card>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Regerar checklist?"
        footer={
          <>
            <Button onClick={() => setResetOpen(false)}>Cancelar</Button>
            <Button
              variant="danger"
              onClick={() => {
                mutate((d) => {
                  d.checklist = buildChecklist({ children: d.personal.children, pets: d.personal.pets, ticketsBought: d.move.ticketsBought, needsTempLodging: d.move.needsTempLodging });
                });
                setResetOpen(false);
              }}
            >
              Regerar e substituir
            </Button>
          </>
        }
      >
        <p className="text-sm text-navy-600">O checklist será recriado a partir do cadastro atual (crianças, animais, passagens, hospedagem). Status e observações atuais serão perdidos.</p>
      </Modal>
    </div>
  );
}
