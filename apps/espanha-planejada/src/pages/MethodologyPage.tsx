import { Card, SectionTitle } from '../components/ui';

function Formula({ children }: { children: React.ReactNode }) {
  return <pre className="my-2 overflow-x-auto rounded-lg bg-navy-900 px-4 py-3 font-mono text-xs leading-relaxed text-verde-200">{children}</pre>;
}

export default function MethodologyPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 text-sm leading-relaxed text-navy-800">
      <SectionTitle sub="Como cada número é calculado. Todas as premissas são editáveis por cenário.">Metodologia</SectionTitle>

      <Card title="1. Subtotal de cada custo">
        <Formula>subtotal = valor unitário × quantidade × multiplicador</Formula>
        <p>
          O multiplicador vem da composição familiar: <em>fixo</em> (1), <em>por adulto</em>, <em>por criança</em>, <em>por pessoa</em> ou <em>por animal</em>. Itens
          compartilhados — aluguel, internet, contas da casa — são fixos. Por isso duas pessoas não custam o dobro de uma.
        </p>
        <p className="mt-2">
          Todo valor guarda moeda, fonte, data da consulta e situação (confirmado, estimado ou sem cotação). Os valores do modelo inicial nascem como “sem
          cotação” e geram alerta até serem substituídos.
        </p>
      </Card>

      <Card title="2. Moradia">
        <Formula>{`aluguel mensal            → entra no custo de vida
caução   = aluguel × meses de caução       → depósito reembolsável
comissão = aluguel × meses de comissão     → gasto definitivo
antecipado além do período financiado
         = aluguel × max(0, meses antecipados − meses financiados) → gasto definitivo`}</Formula>
        <p>O aluguel pago antecipadamente dentro do período financiado já está no custo de vida e não é somado de novo.</p>
      </Card>

      <Card title="3. Meta total de recursos">
        <Formula>{`custo de vida financiado = custo de vida mensal × meses financiados − renda futura incluída
margem   = % de imprevistos × (custos únicos definitivos + custo de vida financiado)
reserva  = meses de reserva × custo de vida mensal   (ou valor fixo em reais)

META = custos únicos definitivos
     + depósitos e cauções
     + custo de vida financiado
     + margem para imprevistos
     + reserva de emergência`}</Formula>
        <ul className="list-disc space-y-1 pl-5">
          <li>Custos marcados como “já pagos” saem da meta e não contam como recurso — o dinheiro já saiu.</li>
          <li>Depósitos aparecem separados: podem voltar no futuro, mas precisam ser pagos na chegada.</li>
          <li>A reserva de emergência é dinheiro que permanece disponível, não um gasto.</li>
          <li>Compromissos que continuam no Brasil (parcelas, apoio a dependentes) entram no custo de vida mensal em reais.</li>
        </ul>
      </Card>

      <Card title="4. Câmbio">
        <Formula>{`câmbio de compra = câmbio × (1 + custo de conversão)
câmbio de venda  = câmbio × (1 − custo de conversão)

necessidade em R$ = parte em reais + parte em euros × câmbio de compra`}</Formula>
        <p>
          Os somatórios são feitos separadamente em euros e em reais. Os euros que o cliente já tem cobrem primeiro as necessidades em euro, valendo o câmbio de
          compra (é o que eles evitam comprar). Euros que sobram valem o câmbio de venda. A tabela de sensibilidade recalcula o plano com outros câmbios e o
          painel mostra quanto cada R$ 0,10 de alta no euro aumenta a meta.
        </p>
      </Card>

      <Card title="5. Recursos e valor faltante">
        <Formula>{`recursos = reserva em reais + outros recursos − valor preservado + euros (ver câmbio)
FALTA    = máximo(0; META − recursos)`}</Formula>
        <p>Se o valor preservado for maior que os reais disponíveis, o excedente é retirado dos euros.</p>
      </Card>

      <Card title="6. Renda futura">
        <p>
          Renda esperada após a chegada nunca entra na meta automaticamente. Quando o cenário a inclui, ela reduz apenas o custo de vida financiado, nos meses
          a partir do seu início, e nunca o deixa negativo. O painel mostra a meta com e sem a renda, e há alertas se ela não estiver confirmada ou se cobrir
          mais do que o limite configurado do custo de vida financiado.
        </p>
      </Card>

      <Card title="7. Prazo e plano de poupança">
        <Formula>{`saldo(mês) = saldo(mês anterior) + poupança do mês + aportes − despesas extraordinárias
meta(mês)  = META × (1 + aumento anual de custos)^(mês/12)
meses até a meta = primeiro mês em que saldo ≥ meta
poupança necessária p/ data pretendida =
   (meta na data − saldo inicial − aportes até lá + despesas extras até lá) ÷ meses até a data`}</Formula>
        <p>
          Não há rendimento de investimentos. A tabela mostra 36 meses; se a meta só for atingida depois, o prazo é informado como “além de 36”. Se a
          poupança for zero ou negativa e não houver aportes futuros, nenhuma data é calculada e o plano é sinalizado como não atingível.
        </p>
      </Card>

      <Card title="8. Cenários">
        <p>
          Econômico, Intermediário e Conservador diferem por premissas explícitas por item (tipo de moradia, aluguel, meses financiados, meses de reserva,
          margem, valores unitários), nunca por um percentual aplicado sobre o total. Todos podem ser editados, duplicados ou recriados a partir do modelo.
        </p>
      </Card>

      <Card title="9. O que a ferramenta não faz">
        <ul className="list-disc space-y-1 pl-5">
          <li>Não avalia elegibilidade migratória nem define prazos legais — registra o que o cliente declara e sinaliza o que precisa ser verificado.</li>
          <li>Não consulta cotações automaticamente — câmbio e preços são informados com fonte e data.</li>
          <li>Não classifica um plano como “seguro” por atingir a meta matemática.</li>
        </ul>
      </Card>
    </div>
  );
}
