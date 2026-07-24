// Lista curada de rotas populares Brasil <-> exterior — mesma filosofia da
// SEED_ROUTES do worker de polling (apps/api/workers/price_polling_worker.py):
// serve de semente até existir um endpoint de "rotas mais buscadas" no backend.
// Usada pelo sitemap; a página de rota em si funciona para QUALQUER par IATA, não só
// estes.

export interface PopularRoute {
  originIata: string;
  destinationIata: string;
  originCity: string;
  destinationCity: string;
}

export const POPULAR_ROUTES: PopularRoute[] = [
  { originIata: "FLN", destinationIata: "MAD", originCity: "Florianópolis", destinationCity: "Madri" },
  { originIata: "GRU", destinationIata: "LIS", originCity: "São Paulo", destinationCity: "Lisboa" },
  { originIata: "GIG", destinationIata: "MCO", originCity: "Rio de Janeiro", destinationCity: "Orlando" },
  { originIata: "GRU", destinationIata: "JFK", originCity: "São Paulo", destinationCity: "Nova York" },
  { originIata: "CNF", destinationIata: "LIS", originCity: "Belo Horizonte", destinationCity: "Lisboa" },
];
