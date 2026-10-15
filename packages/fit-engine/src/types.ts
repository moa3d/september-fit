export const ENGINE_VERSION = "rules-1.0.0" as const;

export type FitPreference = "SLIM" | "REGULAR" | "LOOSE";
export type MeasurementQuality = "BASIC" | "STANDARD" | "VERIFIED";
export type StretchLevel = "NONE" | "LOW" | "MEDIUM" | "HIGH";
export type SupportedCategory = "JACKET" | "HOODIE" | "SHIRT" | "TSHIRT" | "PANTS" | "JEANS";
export type FitLabel = "EXCELLENT" | "GOOD" | "POSSIBLE" | "NOT_IDEAL" | "NOT_RECOMMENDED";
export type FitConfidence = "LOW" | "MEDIUM" | "HIGH";

export interface FitProfile {
  preferredFit: FitPreference;
  heightCm?: number | null;
  weightKg?: number | null;
  chestCm?: number | null;
  waistCm?: number | null;
  hipsCm?: number | null;
  shoulderCm?: number | null;
  sleeveCm?: number | null;
  inseamCm?: number | null;
  thighCm?: number | null;
}

export interface GarmentMeasurements {
  category: SupportedCategory;
  quality: MeasurementQuality;
  fitType?: FitPreference | null;
  stretchLevel: StretchLevel;
  chestWidthCm?: number | null;
  shoulderWidthCm?: number | null;
  sleeveLengthCm?: number | null;
  garmentLengthCm?: number | null;
  waistWidthCm?: number | null;
  hipWidthCm?: number | null;
  thighWidthCm?: number | null;
  inseamCm?: number | null;
}

export interface ScoreRange { optimalMin:number; optimalMax:number; hardMin:number; hardMax:number; }
export type MetricKey = "chestEase"|"shoulderDelta"|"sleeveDelta"|"waistEase"|"hipEase"|"thighEase"|"inseamDelta";

export interface MetricRule {
  key: MetricKey;
  weight: number;
  source: "CIRCUMFERENCE" | "LINEAR";
  profileField: "chestCm"|"waistCm"|"hipsCm"|"shoulderCm"|"sleeveCm"|"inseamCm"|"thighCm";
  garmentField: "chestWidthCm"|"waistWidthCm"|"hipWidthCm"|"shoulderWidthCm"|"sleeveLengthCm"|"inseamCm"|"thighWidthCm";
  ranges: Record<FitPreference, ScoreRange>;
  required?: boolean;
}

export interface CategoryRuleSet { category:SupportedCategory; coreMetric:MetricKey; metrics:MetricRule[]; }
export interface FitMetricResult {
  metric:MetricKey;
  observed:number;
  score:number;
  status:"EXCELLENT"|"GOOD"|"BORDERLINE"|"POOR";
  weight:number;
  expectedRange:ScoreRange;
  explanation:string;
}
export interface FitResult {
  engineVersion: typeof ENGINE_VERSION;
  fitScore:number;
  label:FitLabel;
  confidence:FitConfidence;
  confidenceScore:number;
  preferredFit:FitPreference;
  predictedFit:FitPreference|null;
  category:SupportedCategory;
  coverage:number;
  metrics:Partial<Record<MetricKey,FitMetricResult>>;
  warnings:string[];
  inputSnapshot:{profile:FitProfile; garment:GarmentMeasurements};
}
export type FitEngineErrorCode = "UNSUPPORTED_CATEGORY"|"PROFILE_INCOMPLETE"|"GARMENT_MEASUREMENTS_INCOMPLETE"|"INVALID_INPUT";
export class FitEngineError extends Error {
  constructor(public readonly code:FitEngineErrorCode,message:string,public readonly details?:Record<string,unknown>){super(message);this.name="FitEngineError";}
}
