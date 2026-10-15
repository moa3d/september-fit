export interface BillingCheckoutInput {
  merchantId: string;
  planCode: string;
  successUrl: string;
  cancelUrl: string;
}

export interface BillingCheckoutResult {
  provider: string;
  checkoutUrl: string;
  providerReference: string;
}

export interface BillingProvider {
  createCheckout(
    input: BillingCheckoutInput,
  ): Promise<BillingCheckoutResult>;

  cancelSubscription(
    providerSubscriptionRef: string,
  ): Promise<void>;
}

/**
 * Milestone 10 deliberately does not bind the domain
 * to a specific payment provider.
 *
 * A future adapter may implement:
 * - Stripe
 * - Paddle
 * - Mollie
 * - another supported provider
 */
