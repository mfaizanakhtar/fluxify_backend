#!/usr/bin/env ts-node
/**
 * Query available webhook topics for this app
 */

import 'dotenv/config';
import axios, { AxiosError } from 'axios';
import { getAccessToken } from './utils/shopify-admin';
import type { WebhookSubscriptionTestResponse } from './utils/shopify-types';

const SHOPIFY_DOMAIN = process.env.SHOPIFY_SHOP_DOMAIN;

interface TopicTest {
  name: string;
  topic: string;
}

async function checkAvailableTopics() {
  console.log('🔍 Checking app capabilities and available webhook topics...\n');

  const token = await getAccessToken();

  // Try orders/create instead
  const mutations: TopicTest[] = [
    { name: 'orders/create', topic: 'ORDERS_CREATE' },
    { name: 'orders/paid', topic: 'ORDERS_PAID' },
    { name: 'orders/fulfilled', topic: 'ORDERS_FULFILLED' },
    { name: 'orders/updated', topic: 'ORDERS_UPDATED' },
  ];

  for (const { name, topic } of mutations) {
    console.log(`\n📝 Testing ${name}...`);

    const mutation = `
      mutation {
        webhookSubscriptionCreate(
          topic: ${topic}
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
      const response = await axios.post<WebhookSubscriptionTestResponse>(
        `https://${SHOPIFY_DOMAIN}/admin/api/2026-01/graphql.json`,
        { query: mutation },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': token,
          },
        },
      );

      const result = response.data.data.webhookSubscriptionCreate;
      if (result.userErrors.length > 0) {
        console.log(`   ❌ ${result.userErrors[0].message}`);
      } else if (result.webhookSubscription?.id) {
        console.log(`   ✅ SUCCESS! Created: ${result.webhookSubscription.id}`);
        console.log(`   (Will delete this test webhook next...)`);

        // Delete the test webhook
        const deleteM = `
          mutation {
            webhookSubscriptionDelete(id: "${result.webhookSubscription.id}") {
              userErrors { message }
              deletedWebhookSubscriptionId
            }
          }
        `;
        await axios.post(
          `https://${SHOPIFY_DOMAIN}/admin/api/2026-01/graphql.json`,
          { query: deleteM },
          { headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token } },
        );
        console.log(`   🗑️  Test webhook deleted`);
      }
    } catch (error) {
      console.log(`   ❌ Error testing ${name}`);
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        console.log(`   Error: ${axiosError.message}`);
      }
    }
  }
}

checkAvailableTopics();

checkAvailableTopics().catch(console.error);
