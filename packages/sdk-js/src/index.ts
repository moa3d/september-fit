import type {
  FitCloseEvent,
  FitCompleteEvent,
  MerchantSessionResponse,
  OpenFitOptions,
  OpenMode,
  SeptemberFitInitOptions,
} from "./types.js";

export * from "./types.js";

const DEFAULT_FIT_ORIGIN = "https://fit.septemberfit.com";

class SeptemberFitClient {
  private options: SeptemberFitInitOptions | null = null;
  private overlay: HTMLDivElement | null = null;
  private activeFrameWindow: Window | null = null;
  private activeSessionId: string | null = null;
  private messageHandler = (event: MessageEvent) => {
    this.handleMessage(event);
  };

  init(options: SeptemberFitInitOptions) {
    if (!options?.sessionEndpoint) {
      throw new Error("September Fit: sessionEndpoint is required.");
    }

    this.options = {
      mode: "modal",
      fitOrigin: DEFAULT_FIT_ORIGIN,
      ...options,
    };

    window.removeEventListener("message", this.messageHandler);
    window.addEventListener("message", this.messageHandler);

    return this;
  }

  async open(options: OpenFitOptions): Promise<MerchantSessionResponse> {
    const config = this.requireInit();

    if (!options.productId?.trim()) {
      throw new Error("September Fit: productId is required.");
    }

    const mode: OpenMode =
      options.mode ?? config.mode ?? "modal";

    let pendingTab: Window | null = null;

    if (mode === "new-tab") {
      // Open synchronously while still inside the user's click gesture.
      // Opening only after the async session request is frequently blocked
      // by browser popup protection.
      pendingTab = window.open("about:blank", "_blank");

      if (!pendingTab) {
        const error = new Error(
          "September Fit: the browser blocked the new tab.",
        );
        config.onError?.(error);
        throw error;
      }

      try {
        pendingTab.opener = null;
      } catch {
        // Some browsers make opener read-only; navigation below is still safe.
      }
    }

    try {
      const session = await this.createMerchantSession(options);
      this.activeSessionId = session.session_id;

      if (mode === "new-tab") {
        const url = this.withEmbedParams(session.fit_url, false);
        pendingTab!.location.replace(url);
        this.activeSessionId = null;
        return session;
      }

      this.openModal(session.fit_url);
      return session;
    } catch (error) {
      pendingTab?.close();
      const normalized =
        error instanceof Error ? error : new Error(String(error));
      config.onError?.(normalized);
      throw normalized;
    }
  }

  close() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
      this.activeFrameWindow = null;
      document.documentElement.style.overflow = "";
    }

    this.options?.onClose?.();
    this.activeSessionId = null;
  }

  destroy() {
    this.close();
    window.removeEventListener("message", this.messageHandler);
    this.options = null;
  }

  private requireInit() {
    if (!this.options) {
      throw new Error(
        "September Fit: call SeptemberFit.init(...) before open(...).",
      );
    }

    return this.options;
  }

  private async createMerchantSession(
    options: OpenFitOptions,
  ): Promise<MerchantSessionResponse> {
    const config = this.requireInit();

    const response = await fetch(config.sessionEndpoint, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-September-Fit-SDK": "web-0.1.0",
      },
      body: JSON.stringify({
        product_id: options.productId,
        external_customer_id: options.externalCustomerId,
        profile_id: options.profileId,
        locale: options.locale ?? document.documentElement.lang ?? "ar",
        return_url: options.returnUrl ?? window.location.href,
        metadata: options.metadata,
      }),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        body?.error?.message ??
        body?.message ??
        `Merchant session endpoint returned HTTP ${response.status}.`;
      throw new Error(
        Array.isArray(message) ? message.join(", ") : String(message),
      );
    }

    if (!body?.fit_url || !body?.session_id) {
      throw new Error(
        "Merchant session endpoint did not return session_id and fit_url.",
      );
    }

    return body as MerchantSessionResponse;
  }

  private openModal(fitUrl: string) {
    this.closeWithoutCallback();

    const overlay = document.createElement("div");
    overlay.setAttribute("data-september-fit-overlay", "true");
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483646",
      background: "rgba(24, 16, 18, 0.62)",
      display: "grid",
      placeItems: "center",
      padding: "16px",
    } satisfies Partial<CSSStyleDeclaration>);

    const panel = document.createElement("div");
    Object.assign(panel.style, {
      position: "relative",
      width: "min(100%, 560px)",
      height: "min(92vh, 900px)",
      background: "#FAF7F1",
      borderRadius: "20px",
      overflow: "hidden",
      boxShadow: "0 24px 80px rgba(0,0,0,.28)",
    } satisfies Partial<CSSStyleDeclaration>);

    const close = document.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "Close September Fit");
    close.textContent = "×";
    Object.assign(close.style, {
      position: "absolute",
      zIndex: "3",
      top: "10px",
      left: "10px",
      width: "38px",
      height: "38px",
      borderRadius: "999px",
      border: "1px solid #EADFD2",
      background: "#fff",
      color: "#261A1D",
      fontSize: "24px",
      lineHeight: "1",
      cursor: "pointer",
    } satisfies Partial<CSSStyleDeclaration>);

    close.addEventListener("click", () => this.close());

    const iframe = document.createElement("iframe");
    iframe.src = this.withEmbedParams(fitUrl, true);
    iframe.title = "September Fit";
    iframe.allow = "clipboard-write";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.setAttribute(
      "sandbox",
      "allow-scripts allow-forms allow-same-origin allow-popups",
    );

    Object.assign(iframe.style, {
      width: "100%",
      height: "100%",
      border: "0",
      display: "block",
      background: "#FAF7F1",
    } satisfies Partial<CSSStyleDeclaration>);

    panel.append(close, iframe);
    overlay.append(panel);
    document.body.append(overlay);
    this.activeFrameWindow = iframe.contentWindow;

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) this.close();
    });

    document.documentElement.style.overflow = "hidden";
    this.overlay = overlay;
  }

  private withEmbedParams(rawUrl: string, embed: boolean) {
    const url = new URL(rawUrl, window.location.href);
    if (embed) {
      url.searchParams.set("embed", "1");
      url.searchParams.set("parent_origin", window.location.origin);
    }
    return url.toString();
  }

  private handleMessage(event: MessageEvent) {
    const config = this.options;
    if (!config) return;

    const expectedOrigin = new URL(
      config.fitOrigin ?? DEFAULT_FIT_ORIGIN,
      window.location.href,
    ).origin;

    // Local development support: accept the actual iframe origin if it is
    // the origin configured in fitOrigin. Production must set fitOrigin.
    if (event.origin !== expectedOrigin) return;

    if (
      this.activeFrameWindow &&
      event.source !== this.activeFrameWindow
    ) {
      return;
    }

    const data = event.data as FitCompleteEvent | FitCloseEvent | undefined;
    if (!data || typeof data !== "object" || !("type" in data)) return;

    if (data.type === "september-fit:complete") {
      if (
        this.activeSessionId &&
        data.sessionId &&
        data.sessionId !== this.activeSessionId
      ) {
        return;
      }

      config.onComplete?.(data);
      this.closeWithoutCallback();
      this.activeSessionId = null;
      return;
    }

    if (data.type === "september-fit:close") {
      this.close();
    }
  }

  private closeWithoutCallback() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
      this.activeFrameWindow = null;
      document.documentElement.style.overflow = "";
    }
  }
}

export const SeptemberFit = new SeptemberFitClient();

declare global {
  interface Window {
    SeptemberFit?: SeptemberFitClient;
  }
}

if (typeof window !== "undefined") {
  window.SeptemberFit = SeptemberFit;
}
