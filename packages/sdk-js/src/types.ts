export type OpenMode = "modal" | "new-tab";

export interface SeptemberFitInitOptions {
  /**
   * Merchant-owned server endpoint that creates a September Fit session.
   * Example: /api/september-fit/session
   */
  sessionEndpoint: string;

  /**
   * Optional origin of the hosted Fit application.
   * Used to validate postMessage events.
   * Example: https://fit.septemberfit.com
   */
  fitOrigin?: string;

  /**
   * Default open mode.
   */
  mode?: OpenMode;

  /**
   * Called when a hosted Fit flow completes.
   */
  onComplete?: (event: FitCompleteEvent) => void;

  /**
   * Called when the modal is manually closed.
   */
  onClose?: () => void;

  /**
   * Called when session creation or SDK behavior fails.
   */
  onError?: (error: Error) => void;
}

export interface OpenFitOptions {
  productId: string;
  externalCustomerId?: string;
  profileId?: string;
  locale?: string;
  returnUrl?: string;
  mode?: OpenMode;
  metadata?: Record<string, unknown>;
}

export interface MerchantSessionResponse {
  session_id: string;
  fit_url: string;
  status?: string;
  expires_at?: string;
}

export interface FitCompleteEvent {
  type: "september-fit:complete";
  sessionId: string;
  returnUrl?: string | null;
  fitScore?: number;
  label?: string;
  confidence?: string;
}

export interface FitCloseEvent {
  type: "september-fit:close";
  sessionId?: string;
}
