import 'dotenv/config';
import { shopifyGraphQL } from './utils/shopify-admin';
import type { WebhookSubscriptionUpdateResponse } from './utils/shopify-types';

async function updateWebhook(webhookId: string, newUrl: string) {
  console.log('🔑 Getting access token...');
  console.log(`📝 Updating webhook ${webhookId}...`);
  console.log(`New URL: ${newUrl}/webhook/orders/paid`);

  const mutation = `
    mutation {
      webhookSubscriptionUpdate(
        id: "${webhookId}"
        webhookSubscription: {
          callbackUrl: "${newUrl}/webhook/orders/paid"
        }
      ) {
        webhookSubscription {
          id
          topic
          endpoint {
            __typename
            ... on WebhookHttpEndpoint {
              callbackUrl
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  try {
    const response = await shopifyGraphQL<WebhookSubscriptionUpdateResponse>(mutation);

    const result = response.data.data.webhookSubscriptionUpdate;

    if (result.userErrors.length > 0) {
      console.error('❌ Errors:', result.userErrors);
    } else if (result.webhookSubscription) {
      console.log('✅ Webhook updated successfully!');
      console.log('Webhook ID:', result.webhookSubscription.id);
      console.log('Topic:', result.webhookSubscription.topic);
      console.log('New Callback URL:', result.webhookSubscription.endpoint.callbackUrl);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ Error:', error.message);
    } else {
      console.error('❌ Error:', error);
    }
  }
}

const webhookId = process.argv[2];
const newUrl = process.argv[3];

if (!webhookId || !newUrl) {
  console.error('Usage: npm run webhook:update <webhook-id> <new-ngrok-url>');
  console.error(
    'Example: npm run webhook:update gid://shopify/WebhookSubscription/2144974635338 https://abc123.ngrok-free.dev',
  );
  console.error('');
  console.error('Run `npm run webhook:list` to see all webhook IDs');
  process.exit(1);
}

updateWebhook(webhookId, newUrl);
