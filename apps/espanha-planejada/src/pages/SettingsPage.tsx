import { useState } from 'react';
import { Button, Card, Field, Modal, NumberInput, SectionTitle, Stat, TextInput } from '../components/ui';
import { money } from '../lib/format';
import { useStore } from '../store/useStore';

export default function SettingsPage() {
  const { settings, updateSettings, resetAll, clients } = useStore();
  const [resetOpen, setResetOpen] = useState(false);
  const fx = settings.defaultFx;
  const hourly = settings.consultationHours > 0 ? settings.productBPrice / settings.consultationHours : 0;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <SectionTitle sub="Preços são hipóteses de teste. Tudo aqui é salvo neste navegador.">Configurações</SectionTitle>

      <Card title="Produtos e preços" subtitle="Hipóteses iniciais para validar com os primeiros clientes.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Produto A — Planilha" hint="Faixa inicial a testar: R$ 39 a R$ 59.">
            <NumberInput value={settings.productAPrice} onChange={(v) => updateSettings({ productAPrice: v })} prefix="R$" />
          </Field>
          <Field label="Produto B — Consultoria" hint="Preço-piloto.">
            <NumberInput value={settings.productBPrice} onChange={(v) => updateSettings({ productBPrice: v })} prefix="R$" />
          </Field>
          <Field label="Horas totais por consultoria" hint="Preparação + reunião de 60 min + montagem da entrega.">
            <NumberInput value={settings.consultationHours} onChange={(v) => updateSettings({ consultationHours: v })} suffix="h" />
          </Field>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Stat label="Valor por hora efetivo da consultoria" value={money(hourly)} sub="Antes de impostos e taxas de pagamento." tone={hourly < 50 ? 'warn' : 'default'} />
          <Stat
            label="Planilhas para igualar 1 consultoria"
            value={settings.productAPrice > 0 ? (settings.productBPrice / settings.productAPrice).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—'}
            sub="Ajuda a decidir onde investir esforço de venda."
          />
        </div>
      </Card>

      <Card title="Equipe">
        <Field label="Nome(s) dos consultores" hint="Aparece no relatório.">
          <TextInput value={settings.consultantNames} onChange={(e) => updateSettings({ consultantNames: e.target.value })} />
        </Field>
      </Card>

      <Card title="Câmbio padrão para novos cenários" subtitle="Não há consulta automática de cotação: informe o valor, a data e a fonte.">
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Câmbio (R$ por €1)">
            <NumberInput value={fx.rate} onChange={(v) => updateSettings({ defaultFx: { ...fx, rate: v } })} prefix="R$" />
          </Field>
          <Field label="Data da cotação">
            <TextInput type="date" value={fx.quotedAt} onChange={(e) => updateSettings({ defaultFx: { ...fx, quotedAt: e.target.value } })} />
          </Field>
          <Field label="Fonte">
            <TextInput value={fx.source} onChange={(e) => updateSettings({ defaultFx: { ...fx, source: e.target.value } })} />
          </Field>
          <Field label="Custo de conversão">
            <NumberInput value={fx.conversionCostPct} onChange={(v) => updateSettings({ defaultFx: { ...fx, conversionCostPct: v } })} suffix="%" />
          </Field>
        </div>
      </Card>

      <Card title="Regras dos alertas">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Câmbio desatualizado após" hint="Dias desde a cotação.">
            <NumberInput value={settings.fxStaleDays} onChange={(v) => updateSettings({ fxStaleDays: v })} integer suffix="dias" />
          </Field>
          <Field label="Preço antigo após" hint="Dias desde a consulta de um custo.">
            <NumberInput value={settings.priceStaleDays} onChange={(v) => updateSettings({ priceStaleDays: v })} integer suffix="dias" />
          </Field>
          <Field label="Dependência máxima de renda futura" hint="% do custo de vida financiado.">
            <NumberInput value={settings.incomeDependencyLimitPct} onChange={(v) => updateSettings({ incomeDependencyLimitPct: v })} max={100} suffix="%" />
          </Field>
        </div>
      </Card>

      <Card title="Dados deste navegador">
        <p className="text-sm text-navy-600">
          {clients.length} cliente(s) salvos localmente. Para levar os dados a outro computador, use Exportar/Importar backup na tela de clientes.
        </p>
        <Button variant="danger" className="mt-3" onClick={() => setResetOpen(true)}>
          Apagar todos os dados
        </Button>
      </Card>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Apagar todos os dados?"
        footer={
          <>
            <Button onClick={() => setResetOpen(false)}>Cancelar</Button>
            <Button
              variant="danger"
              onClick={() => {
                resetAll();
                setResetOpen(false);
              }}
            >
              Apagar tudo
            </Button>
          </>
        }
      >
        <p className="text-sm text-navy-600">Todos os clientes e configurações deste navegador serão apagados. Não há como desfazer sem um backup.</p>
      </Modal>
    </div>
  );
}
