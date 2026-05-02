import fetch from 'node-fetch';
import { afterAll, describe, expect, it } from '@jest/globals';

const BASE_URL = process.env.BASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const runId = Date.now();
const poNumber = `PO-AMEND-${runId}`;

function getHeaders(prefer = 'return=representation') {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    Prefer: prefer,
  };
}

async function cleanupPO() {
  if (!BASE_URL || !SUPABASE_ANON_KEY) return;

  await fetch(
    `${BASE_URL}/rest/v1/purchase_orders?po_no=eq.${encodeURIComponent(poNumber)}`,
    {
      method: 'DELETE',
      headers: getHeaders('return=minimal'),
    },
  );
}

describe('PO Amendment Re-approval Integration', () => {
  afterAll(async () => {
    await cleanupPO();
  });

  it('resets an approved PO to pending re-approval after amendment', async () => {
    if (!BASE_URL || !SUPABASE_ANON_KEY) {
      console.warn('BASE_URL or SUPABASE_ANON_KEY not set. Skipping integration test.');
      return;
    }

    const endpoint = `${BASE_URL}/rest/v1/purchase_orders`;

    const createResponse = await fetch(endpoint, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        po_no: poNumber,
        supplier_name: 'Integration Amendment Supplier',
        total_value: 1000,
        status: 'Posted',
        approval_status: 'Approved',
        approved_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }),
    });

    const created = await createResponse.json().catch(() => null);

    expect(createResponse.status).toBe(201);
    expect(Array.isArray(created)).toBe(true);
    expect(created[0].approval_status).toBe('Approved');

    const amendResponse = await fetch(
      `${endpoint}?po_no=eq.${encodeURIComponent(poNumber)}`,
      {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({
          total_value: 1500,
        }),
      },
    );

    const amended = await amendResponse.json().catch(() => null);

    expect(amendResponse.status).toBe(200);
    expect(Array.isArray(amended)).toBe(true);
    expect(amended[0].total_value).toBe(1500);
    expect(['Pending', 'Re-approval Required', 'Pending Re-approval']).toContain(
      amended[0].approval_status,
    );
    expect(amended[0].approved_at).toBeNull();
  });
});
