import 'dotenv/config';
import { shopifyGraphQL } from './utils/shopify-admin';
import type { WebhookSubscriptionsSecretList } from './utils/shopify-types';

async function getWebhookSecret() {
  console.log('🔑 Getting access token...');
  console.log('🔍 Querying webhook details...');

  const query = `
    {
      webhookSubscriptions(first: 10) {
        edges {
          node {
            id
            topic
            format
            endpoint {
              __typename
              ... on WebhookHttpEndpoint {
                callbackUrl
              }
            }
            privateMetafield(namespace: "shopify", key: "hmac_secret") {
              value
            }
          }
        }
      }
    }
  `;

  try {
    const response = await shopifyGraphQL<WebhookSubscriptionsSecretList>(query);

    console.log('\n📦 Response:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    if (error instanceof Error) {
      console.error('\n❌ Error:', error.message);
    } else {
      console.error('\n❌ Error:', error);
    }
  }
}

getWebhookSecret();
