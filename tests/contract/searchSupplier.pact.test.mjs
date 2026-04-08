/**
 * ============================================================
 * Pact Consumer Contract Test — Search Supplier
 * ============================================================
 *
 * WHAT IS BEING TESTED:
 *   This test defines a consumer-side contract for searching
 *   Purchase Orders by supplier name. It simulates the frontend
 *   (consumer) sending a GET request to Supabase's REST endpoint
 *   with an `ilike` filter on `supplier_name`, and verifies the
 *   expected response shape.
 *
 *   The contract captures how the frontend expects the supplier
 *   search to behave, so it can be verified against the actual
 *   Supabase provider later.
 *
 * EXPECTED REQUEST:
 *   GET /rest/v1/purchase_orders?supplier_name=ilike.%25Test%25
 *   Headers:
 *     Content-Type: application/json
 *     apikey: test-api-key
 *
 * EXPECTED RESPONSE:
 *   Status: 200 OK
 *   Body:
 *     {
 *       data: [
 *         {
 *           po_id: <uuid string>,
 *           supplier_name: <string>
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
const { uuid, eachLike, string } = MatchersV3;

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

describe("Supplier Search Contract — Search by Supplier Name", () => {
  // =========================================================================
  // TEST: Successfully searching purchase orders by supplier name
  // =========================================================================
  it("should return matching purchase orders when searching by supplier name", async () => {
    // -----------------------------------------------------------------------
    // 1) ARRANGE — Define the interaction (expected request ↔ response).
    // -----------------------------------------------------------------------

    /**
     * RESPONSE body the frontend expects back from Supabase.
     * `data` is an array of matching records with po_id and supplier_name.
     * `error` should be null on a successful search.
     */
    const expectedResponseBody = eachLike({
      po_id: uuid("a1b2c3d4-e5f6-7890-abcd-ef1234567890"),
      supplier_name: string("Test Supplier"),
    });

    // Register the interaction on the mock provider
    provider
      .given("purchase orders with matching supplier names exist")
      .uponReceiving("a request to search purchase orders by supplier name")
      .withRequest({
        method: "GET",
        path: "/rest/v1/purchase_orders",
        query: {
          "supplier_name": "ilike.%Test%",
        },
        headers: {
          "Content-Type": "application/json",
          apikey: "test-api-key",
        },
      })
      .willRespondWith({
        status: 200,
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
      // Build the full URL with the ilike query parameter
      const url = `${mockServer.url}/rest/v1/purchase_orders?supplier_name=ilike.%25Test%25`;

      // Simulate the HTTP call the frontend would make via Supabase client
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          apikey: "test-api-key",
        },
      });

      // -----------------------------------------------------------------
      // 3) ASSERT — Verify the response matches expectations.
      // -----------------------------------------------------------------

      // Status code must be 200 OK
      expect(response.status).toBe(200);

      // Parse and validate the response body structure
      const responseBody = await response.json();

      // The response should be a raw JSON array
      expect(Array.isArray(responseBody)).toBe(true);
      expect(responseBody.length).toBeGreaterThanOrEqual(1);

      // Each record should contain po_id and supplier_name
      const firstResult = responseBody[0];
      expect(firstResult.po_id).toBeDefined();
      expect(firstResult.supplier_name).toBeDefined();
    });

    // -----------------------------------------------------------------------
    // After this test completes successfully, the Pact contract file at
    // pacts/PharmaPOFrontend-SupabasePOAPI.json is updated to include
    // this search interaction alongside the create PO interaction.
    // -----------------------------------------------------------------------
  });
});
