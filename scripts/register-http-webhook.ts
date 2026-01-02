import 'dotenv/config';
import { shopifyGraphQL } from './utils/shopify-admin';
import type {
  WebhookSubscriptionCreateResponse,
  AppInstallationScopes,
} from './utils/shopify-types';

async function registerHttpWebhook(webhookUrl: string) {
  console.log('📝 Registering HTTP webhook subscription...');

  const mutation = `
    mutation {
      webhookSubscriptionCreate(
        topic: ORDERS_PAID
        webhookSubscription: {
          callbackUrl: "${webhookUrl}/webhook/orders/paid"
          format: JSON
        }
      ) {
        webhookSubscription {
          id
          topic
          format
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
    const response = await shopifyGraphQL<WebhookSubscriptionCreateResponse>(mutation);

    console.log('\n📦 Full Response:');
    console.log(JSON.stringify(response.data, null, 2));

    const result = response.data.data.webhookSubscriptionCreate;

    if (result.userErrors.length > 0) {
      console.error('\n❌ Errors:', result.userErrors);

      const scopeError = result.userErrors.find(
        (err) => err.message.includes('scope') || err.message.includes('cannot create'),
      );

      if (scopeError) {
        console.log('\n💡 This might be a scope or app type issue.');
        console.log('Checking current scopes...');

        const scopesQuery = `
          {
            app {
              installation {
                accessScopes {
                  handle
                }
              }
            }
          }
        `;

        const scopesResponse = await shopifyGraphQL<AppInstallationScopes>(scopesQuery);
        console.log('\n🔐 Current scopes:', scopesResponse.data);
      }
    } else if (result.webhookSubscription) {
      console.log('\n✅ Webhook registered successfully!');
      console.log('Webhook ID:', result.webhookSubscription.id);
      console.log('Topic:', result.webhookSubscription.topic);
      console.log('Callback URL:', result.webhookSubscription.endpoint.callbackUrl);
    }
  } catch (error) {
    console.error('\n❌ Request Error:', error);
  }
}

const webhookUrl = process.argv[2];
if (!webhookUrl) {
  console.error('Usage: npx ts-node scripts/register-http-webhook.ts <webhook-url>');
  process.exit(1);
}

registerHttpWebhook(webhookUrl);
