"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { useCreateAlert } from "@/hooks/use-alerts";
import { ApiError } from "@/lib/api/client";
import type { CabinClass, TripType } from "@/lib/api/types";

const CABIN_CLASS_LABEL: Record<CabinClass, string> = {
  economy: "Econômica",
  premium_economy: "Premium Economy",
  business: "Executiva",
  first: "Primeira Classe",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NewAlertPage() {
  const router = useRouter();
  const createAlert = useCreateAlert();

  const [originIata, setOriginIata] = useState("");
  const [destinationIata, setDestinationIata] = useState("");
  const [tripType, setTripType] = useState<TripType>("round_trip");
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [flexibleDates, setFlexibleDates] = useState(false);
  const [maxPriceReais, setMaxPriceReais] = useState("");
  const [cabinClass, setCabinClass] = useState<CabinClass>("economy");
  const [passengers, setPassengers] = useState(1);
  const [maxStops, setMaxStops] = useState("");
  const [alternativeAirportsOk, setAlternativeAirportsOk] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (originIata.length !== 3) errors.origin_iata = "Use o código IATA de 3 letras (ex.: GRU).";
    if (destinationIata.length !== 3) errors.destination_iata = "Use o código IATA de 3 letras (ex.: LIS).";
    if (!departureDate) errors.departure_date = "Informe a data de ida.";
    if (tripType === "round_trip" && returnDate && returnDate < departureDate) {
      errors.return_date = "A volta não pode ser antes da ida.";
    }
    const priceValue = Number(maxPriceReais.replace(",", "."));
    if (!maxPriceReais || Number.isNaN(priceValue) || priceValue <= 0) {
      errors.max_price_cents = "Informe um preço-alvo válido.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    const priceValue = Number(maxPriceReais.replace(",", "."));

    try {
      const alert = await createAlert.mutateAsync({
        origin_iata: originIata,
        destination_iata: destinationIata,
        trip_type: tripType,
        departure_date: departureDate,
        return_date: tripType === "round_trip" && returnDate ? returnDate : null,
        flexible_dates: flexibleDates,
        max_price_cents: Math.round(priceValue * 100),
        currency: "BRL",
        cabin_class: cabinClass,
        passengers,
        max_stops: maxStops ? Number(maxStops) : null,
        alternative_airports_ok: alternativeAirportsOk,
      });
      router.push(`/alerts/${alert.id}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setFormError(
          "Você atingiu o limite de alertas ativos do plano Gratuito. Exclua um alerta existente ou faça upgrade para o Premium."
        );
      } else if (error instanceof ApiError && error.status === 422) {
        setFormError("Confira os dados informados — algum campo está inválido.");
      } else {
        setFormError("Não foi possível criar o alerta agora. Tente novamente.");
      }
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Criar alerta</h1>
        <p className="text-sm text-muted-foreground">
          Monitoramos a rota e avisamos quando o preço atingir o seu alvo.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalhes da viagem</CardTitle>
          <CardDescription>Todos os campos marcados com * são obrigatórios.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="space-y-8">
            {formError ? (
              <Alert variant="destructive" role="alert">
                {formError}
              </Alert>
            ) : null}

            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold">Rota</legend>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="origin_iata">Origem (IATA) *</Label>
                  <Input
                    id="origin_iata"
                    placeholder="GRU"
                    maxLength={3}
                    required
                    value={originIata}
                    onChange={(e) => setOriginIata(e.target.value.toUpperCase())}
                    className="uppercase"
                    invalid={Boolean(fieldErrors.origin_iata)}
                    aria-describedby={fieldErrors.origin_iata ? "origin_iata-error" : undefined}
                  />
                  {fieldErrors.origin_iata ? (
                    <p id="origin_iata-error" role="alert" className="text-sm text-destructive">
                      {fieldErrors.origin_iata}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="destination_iata">Destino (IATA) *</Label>
                  <Input
                    id="destination_iata"
                    placeholder="LIS"
                    maxLength={3}
                    required
                    value={destinationIata}
                    onChange={(e) => setDestinationIata(e.target.value.toUpperCase())}
                    className="uppercase"
                    invalid={Boolean(fieldErrors.destination_iata)}
                    aria-describedby={fieldErrors.destination_iata ? "destination_iata-error" : undefined}
                  />
                  {fieldErrors.destination_iata ? (
                    <p id="destination_iata-error" role="alert" className="text-sm text-destructive">
                      {fieldErrors.destination_iata}
                    </p>
                  ) : null}
                </div>
              </div>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold">Datas</legend>
              <div className="space-y-2">
                <Label htmlFor="trip_type">Tipo</Label>
                <Select id="trip_type" value={tripType} onChange={(e) => setTripType(e.target.value as TripType)}>
                  <option value="round_trip">Ida e volta</option>
                  <option value="one_way">Somente ida</option>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="departure_date">Ida *</Label>
                  <Input
                    id="departure_date"
                    type="date"
                    min={todayIso()}
                    required
                    value={departureDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                    invalid={Boolean(fieldErrors.departure_date)}
                    aria-describedby={fieldErrors.departure_date ? "departure_date-error" : undefined}
                  />
                  {fieldErrors.departure_date ? (
                    <p id="departure_date-error" role="alert" className="text-sm text-destructive">
                      {fieldErrors.departure_date}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="return_date">Volta</Label>
                  <Input
                    id="return_date"
                    type="date"
                    min={departureDate || todayIso()}
                    disabled={tripType === "one_way"}
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    invalid={Boolean(fieldErrors.return_date)}
                    aria-describedby={fieldErrors.return_date ? "return_date-error" : undefined}
                  />
                  {fieldErrors.return_date ? (
                    <p id="return_date-error" role="alert" className="text-sm text-destructive">
                      {fieldErrors.return_date}
                    </p>
                  ) : null}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={flexibleDates}
                  onChange={(e) => setFlexibleDates(e.target.checked)}
                />
                Datas flexíveis (avisa mesmo se o preço cair em outra data próxima)
              </label>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold">Preço e classe</legend>
              <div className="space-y-2">
                <Label htmlFor="max_price">Preço máximo (R$) *</Label>
                <Input
                  id="max_price"
                  type="text"
                  inputMode="decimal"
                  placeholder="2500"
                  required
                  value={maxPriceReais}
                  onChange={(e) => setMaxPriceReais(e.target.value)}
                  invalid={Boolean(fieldErrors.max_price_cents)}
                  aria-describedby={fieldErrors.max_price_cents ? "max_price-error" : undefined}
                />
                {fieldErrors.max_price_cents ? (
                  <p id="max_price-error" role="alert" className="text-sm text-destructive">
                    {fieldErrors.max_price_cents}
                  </p>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cabin_class">Classe</Label>
                  <Select
                    id="cabin_class"
                    value={cabinClass}
                    onChange={(e) => setCabinClass(e.target.value as CabinClass)}
                  >
                    {Object.entries(CABIN_CLASS_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passengers">Passageiros</Label>
                  <Input
                    id="passengers"
                    type="number"
                    min={1}
                    max={9}
                    value={passengers}
                    onChange={(e) => setPassengers(Number(e.target.value) || 1)}
                  />
                </div>
              </div>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold">Preferências (opcional)</legend>
              <div className="space-y-2">
                <Label htmlFor="max_stops">Máximo de escalas</Label>
                <Input
                  id="max_stops"
                  type="number"
                  min={0}
                  placeholder="Sem limite"
                  value={maxStops}
                  onChange={(e) => setMaxStops(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={alternativeAirportsOk}
                  onChange={(e) => setAlternativeAirportsOk(e.target.checked)}
                />
                Aceito aeroportos alternativos próximos
              </label>
            </fieldset>

            <div className="flex gap-3">
              <Button type="submit" isLoading={createAlert.isPending}>
                Criar alerta
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
