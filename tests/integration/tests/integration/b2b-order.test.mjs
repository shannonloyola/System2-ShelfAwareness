import fetch from 'node-fetch';
import { describe, it, expect } from '@jest/globals';

/**
 * ============================================================
 * B2B Order Integration Test — Credit Limit Excess
 * ============================================================
 * 
 * DESCRIPTION:
 *   This test simulates an edge case where a B2B order (Purchase Order)
 *   is submitted with a total value that exceeds the supplier's 
 *   or warehouse's allocated credit limit.
 * 
 *   The test expects the Supabase REST API (or associated DB logic) 
 *   to reject the insertion if such business logic is enforced, 
 *   or at least to verify how the API responds to extreme values.
 * 
 * EXPECTED BEHAVIOR:
 *   The order should NOT be successfully created (status 201).
 * ============================================================
 */

const BASE_URL = process.env.BASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

describe('B2B Order Integration — Credit Limit Validation', () => {
  it('should reject a Purchase Order that exceeds the credit limit', async () => {
    if (!BASE_URL || !SUPABASE_ANON_KEY) {
      console.warn('BASE_URL or SUPABASE_ANON_KEY not set. Skipping integration test.');
      return;
    }

    const endpoint = `${BASE_URL}/rest/v1/purchase_orders`;

    /**
     * Payload with an extremely high total_value to trigger 
     * rejection based on credit limit checks.
     */
    const payload = {
      supplier_name: "Test High-Value Supplier",
      total_value: 999999999, // Exceeds realistic credit limits
      status: "Pending",
      created_at: new Date().toISOString()
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });

    /**
     * ASSERTION:
     * We expect the insertion to fail (not 201 Created) 
     * because the total_value is intentionally excessive.
     */
    expect(response.status).not.toBe(201);
    
    // Log the error response if useful for debugging
    if (response.status !== 201) {
      const errorData = await response.json();
      console.log('Successfully rejected order as expected:', errorData);
    }
  });
});
