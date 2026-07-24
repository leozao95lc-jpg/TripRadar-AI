// Tipos espelhando os schemas Pydantic da API (apps/api/src/modules/*/interface/schemas.py).
// Mantidos manualmente por enquanto — se o backend crescer muito mais, vale gerar isso
// automaticamente do OpenAPI (`/openapi.json`) em vez de manter os dois em sincronia à mão.

export type TripType = "one_way" | "round_trip";
export type CabinClass = "economy" | "premium_economy" | "business" | "first";
export type AlertStatus = "active" | "paused" | "archived";
export type NotificationChannel = "email" | "whatsapp" | "telegram";
export type TripScoreVerdict = "buy" | "wait" | "insufficient_data";
export type UserPlan = "free" | "premium";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  locale: string;
  role: string;
  plan: UserPlan;
  mfa_enabled: boolean;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface SearchAlert {
  id: string;
  origin_iata: string;
  destination_iata: string;
  trip_type: TripType;
  departure_date: string;
  return_date: string | null;
  flexible_dates: boolean;
  max_price_cents: number;
  currency: string;
  cabin_class: CabinClass;
  passengers: number;
  max_stops: number | null;
  alternative_airports_ok: boolean;
  status: AlertStatus;
  created_at: string;
}

export interface CreateAlertInput {
  origin_iata: string;
  destination_iata: string;
  trip_type: TripType;
  departure_date: string;
  return_date?: string | null;
  flexible_dates: boolean;
  max_price_cents: number;
  currency: string;
  cabin_class: CabinClass;
  passengers: number;
  max_stops?: number | null;
  alternative_airports_ok: boolean;
}

export interface PriceSnapshot {
  departure_date: string;
  return_date: string | null;
  price_cents: number;
  currency: string;
  airline_iata: string | null;
  collected_at: string;
}

export interface PriceHistory {
  origin_iata: string;
  destination_iata: string;
  cabin_class: CabinClass;
  range_days: number;
  min_price_cents: number | null;
  avg_price_cents: number | null;
  max_price_cents: number | null;
  snapshots: PriceSnapshot[];
}

export interface TripScore {
  origin_iata: string;
  destination_iata: string;
  cabin_class: CabinClass;
  verdict: TripScoreVerdict;
  confidence: number;
  current_price_cents: number;
  target_price_cents: number;
  explanation: string;
  factors: {
    hit_rate?: number;
    below_avg_pct?: number;
    trend_7d?: "up" | "down" | "stable";
    sample_size?: number;
    mileage_comparison?: { program: string; estimated_miles: number }[];
    currency_signal?: "favorable" | "unfavorable" | "stable" | "unknown";
  };
  generated_at: string;
}

export interface NotificationPreference {
  channel: NotificationChannel;
  destination: string;
  enabled: boolean;
  pending_verification: boolean;
}

export interface WorkerRun {
  worker_name: string;
  started_at: string;
  finished_at: string;
  success: boolean;
  routes_ok: number;
  routes_failed: number;
  error_message: string | null;
  recorded_at: string;
}

export interface FeatureFlagSummary {
  key: string;
  enabled: boolean;
  rollout_percentage: number;
}

export interface FeatureFlag extends FeatureFlagSummary {
  description: string;
  updated_at: string;
}

export interface SetFeatureFlagInput {
  enabled: boolean;
  rollout_percentage: number;
  description?: string | null;
}

export interface AdminDashboard {
  users_total: number;
  users_new_7d: number;
  alerts_active_total: number;
  alerts_created_7d: number;
  alert_triggers_7d: number;
  notifications_sent_7d_by_channel: Record<string, number>;
  notifications_sent_7d_by_status: Record<string, number>;
  price_snapshots_24h: number;
  product_events_7d: Record<string, number>;
  worker_runs: WorkerRun[];
  feature_flags: FeatureFlagSummary[];
  generated_at: string;
}
