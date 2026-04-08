/**
 * ============================================================
 * Pact Consumer Contract Test — Create Purchase Order (PO)
 * ============================================================
 *
 * WHAT IS BEING TESTED:
 *   This test defines a consumer-side contract for the "Create
 *   Purchase Order" interaction. It simulates the frontend
 *   (consumer) sending a POST request to a Supabase-style REST
 *   endpoint to insert a new Purchase Order row, and verifies
 *   the expected response shape.
 *
 *   Because the real backend is Supabase (a hosted service),
 *   we use Pact to capture the contract — i.e. the agreed-upon
 *   request/response structure — so it can later be verified
 *   against the actual provider if needed.
 *
 * EXPECTED REQUEST:
 *   POST /rest/v1/purchase_orders
 *   Headers:
 *     Content-Type: application/json
 *     apikey: <test-api-key>
 *     Prefer: return=representation
 *   Body:
 *     {
 *       po_no: "PO-TEST-001",
 *       supplier_name: "Test Supplier",
 *       status: "Draft",
 *       created_at: "2026-01-01T00:00:00Z",
 *       paid_at: "2026-01-01T00:00:00Z",
 *       expected_delivery_date: null
 *     }
 *
 * EXPECTED RESPONSE:
 *   Status: 201 Created
 *   Body:
 *     {
 *       data: [
 *         {
 *           po_id: <uuid string>,
 *           po_no: "PO-TEST-001",
 *           supplier_name: "Test Supplier",
 *           status: "Draft"
 *         }
 *       ],
 *       error: null
 *     }
 *
 * GENERATED ARTIFACT:
 *   A Pact contract JSON file is written to the `pacts/` directory
 *   at the project root after a successful test run.
 * ============================================================
 */

import path from "path";
import { describe, it, expect } from "@jest/globals";
import { PactV3, MatchersV3 } from "@pact-foundation/pact";

// ---------------------------------------------------------------------------
// Pull in Pact V3 matchers so the contract is flexible on dynamic values
// (e.g. UUIDs) while still enforcing the shape/type.
// ---------------------------------------------------------------------------
const { like, uuid, eachLike, string } = MatchersV3;

// ---------------------------------------------------------------------------
// Configure the Pact mock provider.
//
// • `consumer`  — the name of this frontend application (the consumer).
// • `provider`  — the name of the backend/service we depend on (Supabase).
// • `dir`       — where the generated pact contract JSON will be saved.
// • `logLevel`  — verbosity of Pact's internal logging during tests.
// ---------------------------------------------------------------------------
const provider = new PactV3({
  consumer: "PharmaPOFrontend",
  provider: "SupabasePOAPI",
  dir: path.resolve(process.cwd(), "pacts"),
  logLevel: "warn",
});

describe("Purchase Order Contract — Create PO", () => {
  // =========================================================================
  // TEST: Successfully creating a new Purchase Order
  // =========================================================================
  it("should create a Purchase Order and return 201 with the new record", async () => {
    // -----------------------------------------------------------------------
    // 1) ARRANGE — Define the interaction (expected request ↔ response).
    // -----------------------------------------------------------------------

    /**
     * REQUEST body sent by the frontend when creating a PO.
     * This mirrors the shape of the `purchase_orders` table in Supabase.
     */
    const requestBody = {
      po_no: "PO-TEST-001",
      supplier_name: "Test Supplier",
      status: "Draft",
      created_at: "2026-01-01T00:00:00Z",
      paid_at: "2026-01-01T00:00:00Z",
      expected_delivery_date: null,
    };

    /**
     * RESPONSE body the frontend expects back from Supabase.
     * `data` is an array containing the newly-created record.
     * `error` should be null on success.
     */
    const expectedResponseBody = {
      data: eachLike({
        po_id: uuid("a1b2c3d4-e5f6-7890-abcd-ef1234567890"),
        po_no: string("PO-TEST-001"),
        supplier_name: string("Test Supplier"),
        status: string("Draft"),
      }),
      error: null,
    };

    // Register the interaction on the mock provider
    provider
      .given("a valid Purchase Order can be created")
      .uponReceiving("a request to create a new Purchase Order")
      .withRequest({
        method: "POST",
        path: "/rest/v1/purchase_orders",
        headers: {
          "Content-Type": "application/json",
          apikey: like("test-api-key"),
          Prefer: "return=representation",
        },
        body: requestBody,
      })
      .willRespondWith({
        status: 201,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
        body: expectedResponseBody,
      });

    // -----------------------------------------------------------------------
    // 2) ACT — Execute the consumer code against the Pact mock server.
    //    `provider.executeTest` spins up a local mock server, runs the
    //    callback, then verifies all registered interactions were hit.
    // -----------------------------------------------------------------------
    await provider.executeTest(async (mockServer) => {
      // Build the full URL to the mock server's endpoint
      const url = `${mockServer.url}/rest/v1/purchase_orders`;

      // Simulate the HTTP call the frontend would make via Supabase client
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: "test-api-key",
          Prefer: "return=representation",
        },
        body: JSON.stringify(requestBody),
      });

      // -----------------------------------------------------------------
      // 3) ASSERT — Verify the response matches expectations.
      // -----------------------------------------------------------------

      // Status code must be 201 Created
      expect(response.status).toBe(201);

      // Parse and validate the response body structure
      const responseBody = await response.json();

      // `data` should be an array with at least one record
      expect(responseBody.data).toBeDefined();
      expect(Array.isArray(responseBody.data)).toBe(true);
      expect(responseBody.data.length).toBeGreaterThanOrEqual(1);

      // The first record should contain the expected fields
      const createdPO = responseBody.data[0];
      expect(createdPO.po_id).toBeDefined();
      expect(createdPO.po_no).toBe("PO-TEST-001");
      expect(createdPO.supplier_name).toBe("Test Supplier");
      expect(createdPO.status).toBe("Draft");

      // `error` should be null on a successful creation
      expect(responseBody.error).toBeNull();
    });

    // -----------------------------------------------------------------------
    // After this test completes successfully, a Pact contract file is
    // generated at: pacts/PharmaPOFrontend-SupabasePOAPI.json
    //
    // This JSON contract can be shared with the provider (or used in CI)
    // to verify that the backend still honours this interaction.
    // -----------------------------------------------------------------------
  });
});
