import 'dotenv/config';
import { shopifyGraphQL } from './utils/shopify-admin';
import type { WebhookSubscriptionDeleteResponse } from './utils/shopify-types';

async function deleteWebhook(webhookId: string) {
  console.log('🔑 Getting access token...');
  console.log(`🗑️  Deleting webhook ${webhookId}...`);

  const mutation = `
    mutation {
      webhookSubscriptionDelete(id: "${webhookId}") {
        deletedWebhookSubscriptionId
        userErrors {
          field
          message
        }
      }
    }
  `;

  try {
    const response = await shopifyGraphQL<WebhookSubscriptionDeleteResponse>(mutation);

    const result = response.data.data.webhookSubscriptionDelete;

    if (result.userErrors.length > 0) {
      console.error('❌ Errors:', result.userErrors);
    } else if (result.deletedWebhookSubscriptionId) {
      console.log('✅ Webhook deleted successfully!');
      console.log('Deleted ID:', result.deletedWebhookSubscriptionId);
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
if (!webhookId) {
  console.error('Usage: npm run webhook:delete <webhook-id>');
  console.error('Example: npm run webhook:delete gid://shopify/WebhookSubscription/2144974635338');
  console.error('');
  console.error('Run `npm run webhook:list` to see all webhook IDs');
  process.exit(1);
}

deleteWebhook(webhookId);
