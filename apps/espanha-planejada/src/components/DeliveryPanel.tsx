import { CheckCircle2, ClipboardCopy, Download, ExternalLink, FileSpreadsheet, FileText, PackageCheck, Trash2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { unquotedLines, type Analysis } from '../domain/analysis';
import type { Client, Delivery } from '../domain/types';
import { exportChecklistCSV, exportCostsCSV, exportExcel, exportProjectionCSV, exportSummaryTXT } from '../lib/exporters';
import { uid } from '../lib/id';
import { executiveSummary } from '../lib/text';
import type { Mutate } from '../pages/ClientWorkspace';
import { Button, Card, Modal, TextInput, cx } from './ui';

export default function DeliveryPanel({ client, mutate, analysis }: { client: Client; mutate: Mutate; analysis: Analysis }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [finalOpen, setFinalOpen] = useState(false);
  const [label, setLabel] = useState('');
  const summary = executiveSummary(client, analysis);
  const { plan, alerts, scenario } = analysis;

  const gate: { ok: boolean; text: string }[] = [
    { ok: plan.valid, text: 'Cálculo completo (câmbio e composição informados)' },
    { ok: Boolean(client.personal.name.trim() && client.move.targetCity.trim()), text: 'Cadastro com nome e cidade' },
    { ok: unquotedLines(plan).length === 0, text: `Todos os custos com fonte e data (${unquotedLines(plan).length} pendente(s))` },
    { ok: !alerts.some((a) => a.id === 'cambio_desatualizado'), text: 'Câmbio atualizado' },
    { ok: !alerts.some((a) => a.id === 'renda_nao_confirmada'), text: 'Meta não depende de renda não confirmada' },
    { ok: Boolean(client.notes.recommendations.trim() && client.notes.nextSteps.trim()), text: 'Recomendações e próximos passos registrados' },
  ];
  const ready = gate.every((g) => g.ok);

  const run = async (fn: () => void | Promise<void>, okText: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      setMessage({ ok: true, text: okText });
    } catch (e) {
      setMessage({ ok: false, text: `Falha ao gerar o arquivo: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Exportar" subtitle={`Cenário em análise: ${scenario.name}. Os arquivos são gerados no navegador e baixados para o computador.`}>
          <div className="flex flex-col gap-2">
            <Link
              to={`/clientes/${client.id}/relatorio`}
             
              className="flex items-center justify-between gap-2 rounded-xl border border-areia-200 px-4 py-3 text-sm hover:bg-areia-50"
            >
              <span className="flex items-center gap-2 font-medium text-navy-900">
                <FileText className="h-4 w-4 text-verde-600" /> Relatório financeiro (PDF)
              </span>
              <span className="text-xs text-navy-500">abre o relatório → “Salvar como PDF”</span>
            </Link>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => exportExcel(client, analysis), 'Planilha Excel gerada.')}
              className="flex items-center justify-between gap-2 rounded-xl border border-areia-200 px-4 py-3 text-left text-sm hover:bg-areia-50 disabled:opacity-50"
            >
              <span className="flex items-center gap-2 font-medium text-navy-900">
                <FileSpreadsheet className="h-4 w-4 text-verde-600" /> Planilha Excel (.xlsx)
              </span>
              <span className="text-xs text-navy-500">resumo, premissas, custos, poupança, cenários, checklist</span>
            </button>
            <div className="grid gap-2 sm:grid-cols-3">
              <Button disabled={busy} onClick={() => run(() => exportCostsCSV(client), 'CSV de custos gerado.')}>
                <Download className="h-4 w-4" /> CSV custos
              </Button>
              <Button disabled={busy} onClick={() => run(() => exportProjectionCSV(client, analysis), 'CSV do plano de poupança gerado.')}>
                <Download className="h-4 w-4" /> CSV poupança
              </Button>
              <Button disabled={busy} onClick={() => run(() => exportChecklistCSV(client), 'CSV do checklist gerado.')}>
                <Download className="h-4 w-4" /> CSV checklist
              </Button>
            </div>
            <Link
              to={`/clientes/${client.id}/relatorio?modo=checklist`}
             
              className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-verde-700 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Checklist para imprimir / PDF
            </Link>
            {message && <p className={cx('rounded-lg px-3 py-2 text-sm', message.ok ? 'bg-verde-50 text-verde-700' : 'bg-terra-50 text-terra-700')}>{message.text}</p>}
          </div>
        </Card>

        <Card title="Pronto para entregar?" subtitle="Verificação de qualidade antes de gerar a versão final.">
          <ul className="flex flex-col gap-2">
            {gate.map((g) => (
              <li key={g.text} className="flex items-start gap-2 text-sm">
                {g.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-verde-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-terra-600" />}
                <span className={g.ok ? 'text-navy-700' : 'text-navy-900'}>{g.text}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant={ready ? 'success' : 'primary'} onClick={() => setFinalOpen(true)}>
              <PackageCheck className="h-4 w-4" /> Gerar versão final
            </Button>
            {!ready && <p className="text-xs text-navy-500">É possível gerar mesmo com pendências; elas ficam registradas no relatório.</p>}
          </div>
        </Card>
      </div>

      <Card
        title="Resumo executivo"
        subtitle="Gerado a partir dos números do cenário. Revise antes de enviar."
        action={
          <div className="flex gap-2">
            <Button size="sm" onClick={() => run(() => navigator.clipboard.writeText(summary), 'Resumo copiado para a área de transferência.')}>
              <ClipboardCopy className="h-3.5 w-3.5" /> Copiar
            </Button>
            <Button size="sm" onClick={() => run(() => exportSummaryTXT(client, analysis), 'Resumo baixado (.txt).')}>
              <Download className="h-3.5 w-3.5" /> Baixar .txt
            </Button>
          </div>
        }
      >
        <pre className="whitespace-pre-wrap rounded-xl bg-areia-50 p-4 font-sans text-sm leading-relaxed text-navy-800">{summary}</pre>
      </Card>

      <Card title="Versões entregues" subtitle="Cada versão final congela os dados do cliente naquele momento. Alterações posteriores não afetam versões já entregues.">
        {client.deliveries.length === 0 ? (
          <p className="text-sm text-navy-500">Nenhuma versão final gerada ainda.</p>
        ) : (
          <ul className="divide-y divide-areia-100">
            {[...client.deliveries].reverse().map((d: Delivery) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <p className="text-sm font-medium text-navy-900">
                    Versão {d.version}
                    {d.label && ` — ${d.label}`}
                  </p>
                  <p className="text-xs text-navy-500">{new Date(d.createdAt).toLocaleString('pt-BR')}</p>
                </div>
                <div className="flex gap-2">
                  <Link
                    to={`/clientes/${client.id}/relatorio?versao=${d.id}`}
                   
                    className="inline-flex items-center gap-1 rounded-lg border border-areia-300 px-2.5 py-1.5 text-xs font-medium hover:bg-areia-50"
                  >
                    <FileText className="h-3.5 w-3.5" /> Relatório
                  </Link>
                  <Button size="sm" variant="ghost" aria-label="Excluir versão" onClick={() => mutate((c) => void (c.deliveries = c.deliveries.filter((x) => x.id !== d.id)))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={finalOpen}
        onClose={() => setFinalOpen(false)}
        title="Gerar versão final"
        footer={
          <>
            <Button onClick={() => setFinalOpen(false)}>Cancelar</Button>
            <Button
              variant="success"
              onClick={() => {
                mutate((d) => {
                  const { deliveries, ...snapshot } = structuredClone(d);
                  const version = deliveries.reduce((mx, x) => Math.max(mx, x.version), 0) + 1;
                  d.deliveries.push({ id: uid('dl'), version, createdAt: new Date().toISOString(), label: label.trim(), snapshot });
                  d.status = 'entregue';
                });
                setLabel('');
                setFinalOpen(false);
                setMessage({ ok: true, text: 'Versão final registrada. Abra o relatório da versão para salvar o PDF.' });
              }}
            >
              Confirmar
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-navy-600">
          Os dados atuais (cadastro, cenários, plano, checklist e anotações) serão congelados como uma nova versão, e o status do cliente passará a
          “Entregue”.
        </p>
        <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Rótulo opcional (ex.: pós-reunião)" />
      </Modal>
    </div>
  );
}
