import type { Client, ConsultantNotes } from '../domain/types';
import type { Mutate } from '../pages/ClientWorkspace';
import { Card, Field, TextArea } from './ui';

export const NOTE_FIELDS: { key: keyof ConsultantNotes; label: string; hint: string }[] = [
  { key: 'objectives', label: 'Principais objetivos do cliente', hint: 'O que o cliente quer alcançar com a mudança.' },
  { key: 'risks', label: 'Maiores riscos financeiros', hint: 'Câmbio, renda incerta, dívidas, dependentes, custos sem cotação.' },
  { key: 'decisions', label: 'Decisões tomadas na reunião', hint: 'Cenário escolhido, data, tipo de moradia, reserva.' },
  { key: 'pending', label: 'Pendências', hint: 'O que falta confirmar ou cotar.' },
  { key: 'recommendations', label: 'Recomendações práticas', hint: 'Orientações objetivas para o cliente.' },
  { key: 'nextSteps', label: 'Próximos passos acordados', hint: 'Ações com responsável e prazo combinados.' },
  { key: 'general', label: 'Observações gerais', hint: 'Uso interno.' },
];

export default function NotesEditor({ client, mutate }: { client: Client; mutate: Mutate }) {
  return (
    <Card title="Anotações da consultoria" subtitle="Aparecem no relatório final, exceto as observações gerais (uso interno). Salvas automaticamente.">
      <div className="grid gap-4 md:grid-cols-2">
        {NOTE_FIELDS.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint}>
            <TextArea rows={4} value={client.notes[f.key]} onChange={(e) => mutate((d) => void (d.notes[f.key] = e.target.value))} />
          </Field>
        ))}
      </div>
    </Card>
  );
}
