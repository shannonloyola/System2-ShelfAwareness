import fetch from 'node-fetch';
import { afterAll, describe, expect, it } from '@jest/globals';

const BASE_URL = process.env.BASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const runId = Date.now();
const requisitionNotes = `Integration Test Requisition ${runId}`;
const poNumber = `PO-INT-${runId}`;

function getHeaders() {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

async function deleteByFilter(table, filter) {
  if (!BASE_URL || !SUPABASE_ANON_KEY) return;

  await fetch(`${BASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
}

describe('Requisition and PO Creation Integration', () => {
  afterAll(async () => {
    await deleteByFilter(
      'purchase_orders',
      `po_no=eq.${encodeURIComponent(poNumber)}`,
    );
    await deleteByFilter(
      'requisitions',
      `notes=eq.${encodeURIComponent(requisitionNotes)}`,
    );
  });

  it('submits a requisition record to the test database', async () => {
    if (!BASE_URL || !SUPABASE_ANON_KEY) {
      console.warn('BASE_URL or SUPABASE_ANON_KEY not set. Skipping integration test.');
      return;
    }

    const response = await fetch(`${BASE_URL}/rest/v1/requisitions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        requester_name: 'Integration Test User',
        department: 'QA',
        notes: requisitionNotes,
        items: [
          {
            sku: 'TEST-SKU-001',
            quantity: 2,
          },
        ],
      }),
    });

    const body = await response.json().catch(() => null);

    expect(response.status).toBe(201);
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toMatchObject({
      requester_name: 'Integration Test User',
      department: 'QA',
      notes: requisitionNotes,
    });
    expect(body[0].items).toEqual([
      {
        sku: 'TEST-SKU-001',
        quantity: 2,
      },
    ]);
  });

  it('creates a purchase order record in the test database', async () => {
    if (!BASE_URL || !SUPABASE_ANON_KEY) {
      console.warn('BASE_URL or SUPABASE_ANON_KEY not set. Skipping integration test.');
      return;
    }

    const response = await fetch(`${BASE_URL}/rest/v1/purchase_orders`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        po_no: poNumber,
        supplier_name: 'Integration Test Supplier',
        total_value: 1250.75,
        status: 'Draft',
        created_at: new Date().toISOString(),
      }),
    });

    const body = await response.json().catch(() => null);

    expect(response.status).toBe(201);
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toMatchObject({
      po_no: poNumber,
      supplier_name: 'Integration Test Supplier',
      total_value: 1250.75,
      status: 'Draft',
    });
  });
});
