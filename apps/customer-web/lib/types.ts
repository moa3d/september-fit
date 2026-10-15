export type SessionStatus =
  | "CREATED"
  | "PROFILE_REQUIRED"
  | "READY"
  | "CALCULATED"
  | "COMPLETED"
  | "EXPIRED"
  | "CANCELLED";

export type FitPreference = "SLIM" | "REGULAR" | "LOOSE";
export type ProfileType = "MENS" | "WOMENS" | "UNISEX";


export interface FitMetricDetail {
  metric?: string;
  observed?: number;
  score?: number;
  status?: string;
  weight?: number;
  expectedRange?: {
    optimalMin: number;
    optimalMax: number;
    hardMin: number;
    hardMax: number;
  };
  explanation?: string;
}

export interface FitResultPayload {
  id: string;
  session_id?: string;
  product_id?: string;
  profile_id?: string;
  fit_score: number;
  label: string;
  label_ar: string;
  confidence: string;
  confidence_score?: number;
  predicted_fit: FitPreference | null;
  engine_version: string;
  coverage?: number;
  details: Record<string, FitMetricDetail>;
  warnings?: string[];
  created_at?: string;
}

export interface HostedSession {
  session_id: string;
  status: SessionStatus;
  merchant: {
    name: string;
  };
  product: {
    id: string;
    name: string;
    brand: string | null;
    category: string;
    original_size_label: string | null;
    measurement_quality: string | null;
  };
  has_profile: boolean;
  result: null | {
    id: string;
    fit_score: number;
    label: string;
    label_ar?: string;
    confidence: string;
    confidence_score?: number;
    predicted_fit: FitPreference | null;
    engine_version: string;
    coverage?: number;
    details: Record<string, FitMetricDetail>;
    warnings?: string[];
  };
  return_url: string | null;
  locale: string;
  expires_at: string;
}

export interface PublicProfilePayload {
  profile_type: ProfileType;
  preferred_fit: FitPreference;
  height_cm?: number;
  weight_kg?: number;
  chest_cm?: number;
  waist_cm?: number;
  hips_cm?: number;
  shoulder_cm?: number;
  sleeve_cm?: number;
  inseam_cm?: number;
  thigh_cm?: number;
}

export interface PublicCalculateResponse {
  status: "CALCULATED" | "PROFILE_REQUIRED";
  session_id: string;
  result?: FitResultPayload;
  return_url?: string | null;
}

export interface PublicFeedbackPage {
  request_id: string;
  status: string;
  merchant: {
    name: string;
  };
  product: {
    id: string;
    name: string;
    brand: string | null;
    category: string;
    original_size_label: string | null;
  };
  prediction: null | {
    fit_score: number;
    label: string;
    confidence: string;
    predicted_fit: FitPreference | null;
    engine_version: string;
  };
  submitted: boolean;
  return_url: string | null;
  expires_at: string;
}

export interface SubmitFeedbackPayload {
  overall: "TOO_SMALL" | "PERFECT" | "TOO_LARGE";
  problem_areas?: string[];
  note?: string;
}

export interface SubmitFeedbackResponse {
  feedback_id: string;
  status: "COMPLETED";
  message: string;
  return_url: string | null;
}

