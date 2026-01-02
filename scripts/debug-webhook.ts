#!/usr/bin/env ts-node
/**
 * Test webhook subscription creation with detailed error output
 */

import 'dotenv/config';
import { shopifyGraphQL } from './utils/shopify-admin';
import type { AxiosError } from 'axios';
import type { WebhookSubscriptionCreateResponse } from './utils/shopify-types';

async function testWebhookCreation() {
  console.log('🔍 Testing webhook creation with detailed output...\n');

  const mutation = `
    mutation {
      webhookSubscriptionCreate(
        topic: ORDERS_PAID
        webhookSubscription: {
          callbackUrl: "https://example.com/webhook"
          format: JSON
        }
      ) {
        webhookSubscription {
          id
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

    console.log('📦 Full Response:', JSON.stringify(response.data, null, 2));

    const result = response.data.data.webhookSubscriptionCreate;
    if (result.userErrors.length > 0) {
      console.log('\n❌ Errors found:');
      result.userErrors.forEach((e) => {
        console.log(`  - ${e.field.join('.')}: ${e.message}`);
      });
    } else {
      console.log('\n✅ Success!');
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as AxiosError;
      console.log('❌ HTTP Error:', axiosError.response?.status);
      console.log('Response data:', JSON.stringify(axiosError.response?.data, null, 2));
    } else {
      console.error('❌ Error:', error);
    }
  }
}

testWebhookCreation().catch(console.error);
