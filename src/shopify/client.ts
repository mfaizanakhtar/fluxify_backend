import axios, { AxiosInstance } from 'axios';

interface ShopifyConfig {
  shopDomain: string;
  clientId: string;
  clientSecret: string;
}

interface TokenResponse {
  access_token: string;
  scope: string;
  expires_in: number;
}

/**
 * Shopify Admin API client with automatic token refresh
 * Uses client credentials grant (OAuth 2.0)
 */
export class ShopifyClient {
  private config: ShopifyConfig;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private refreshPromise: Promise<string> | null = null;
  private axiosInstance: AxiosInstance;

  constructor(config: ShopifyConfig) {
    this.config = config;
    this.axiosInstance = axios.create({
      baseURL: `https://${config.shopDomain}/admin/api/2026-01`,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get valid access token, refresh if needed
   */
  private async getAccessToken(): Promise<string> {
    const now = Date.now();

    // Token still valid (with 5min buffer)
    if (this.accessToken && this.tokenExpiresAt > now + 5 * 60 * 1000) {
      return this.accessToken;
    }

    // Another request is already refreshing
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Refresh token
    this.refreshPromise = this.refreshAccessToken();
    try {
      const token = await this.refreshPromise;
      return token;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Exchange client credentials for access token
   */
  private async refreshAccessToken(): Promise<string> {
    try {
      const response = await axios.post<TokenResponse>(
        `https://${this.config.shopDomain}/admin/oauth/access_token`,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiresAt = Date.now() + response.data.expires_in * 1000;

      console.log(
        '[Shopify] Access token refreshed, expires in',
        response.data.expires_in,
        'seconds',
      );
      return this.accessToken;
    } catch (error) {
      console.error('[Shopify] Failed to refresh access token:', error);
      throw new Error('Failed to authenticate with Shopify');
    }
  }

  /**
   * Get order details by order ID
   */
  async getOrder(orderId: string): Promise<unknown> {
    const token = await this.getAccessToken();
    const response = await this.axiosInstance.get(`/orders/${orderId}.json`, {
      headers: {
        'X-Shopify-Access-Token': token,
      },
    });
    return response.data.order;
  }

  /**
   * Get variant metafields
   */
  async getVariantMetafields(variantId: string): Promise<unknown[]> {
    const token = await this.getAccessToken();
    const response = await this.axiosInstance.get(`/variants/${variantId}/metafields.json`, {
      headers: {
        'X-Shopify-Access-Token': token,
      },
    });
    return response.data.metafields || [];
  }

  /**
   * Create fulfillment for line items
   */
  async createFulfillment(
    orderId: string,
    lineItems: { id: string; quantity: number }[],
  ): Promise<unknown> {
    const token = await this.getAccessToken();
    const response = await this.axiosInstance.post(
      `/orders/${orderId}/fulfillments.json`,
      {
        fulfillment: {
          line_items: lineItems,
          notify_customer: false,
        },
      },
      {
        headers: {
          'X-Shopify-Access-Token': token,
        },
      },
    );
    return response.data.fulfillment;
  }

  /**
   * Initialize token on startup (optional but recommended)
   */
  async initialize(): Promise<void> {
    await this.getAccessToken();
  }
}

// Singleton instance
let shopifyClient: ShopifyClient | null = null;

export function getShopifyClient(): ShopifyClient {
  if (!shopifyClient) {
    const config = {
      shopDomain: process.env.SHOPIFY_SHOP_DOMAIN!,
      clientId: process.env.SHOPIFY_CLIENT_ID!,
      clientSecret: process.env.SHOPIFY_CLIENT_SECRET!,
    };

    if (!config.shopDomain || !config.clientId || !config.clientSecret) {
      throw new Error('Missing Shopify credentials in environment variables');
    }

    shopifyClient = new ShopifyClient(config);
  }

  return shopifyClient;
}
