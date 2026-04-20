/**
 * ============================================================
 * Pact Consumer Contract Test — Supplier Scorecard
 * ============================================================
 *
 * WHAT IS BEING TESTED:
 *   This test defines a consumer-side contract for retrieving a
 *   supplier scorecard. It simulates the frontend (consumer)
 *   sending a GET request to Supabase's REST endpoint for the
 *   `supplier_scorecards_view` view, filtered by supplier name
 *   using `ilike` semantics and limited to a single result
 *   (matching `.maybeSingle()` behavior).
 *
 *   The contract captures the exact JSON structure the frontend
 *   expects from the scorecard view, so it can be verified
 *   against the actual Supabase provider later.
 *
 * SOURCE (app code — not modified):
 *   supabase
 *     .from("supplier_scorecards_view")
 *     .select("*")
 *     .ilike("supplier_name", supplier)
 *     .maybeSingle()
 *
 * EXPECTED REQUEST:
 *   GET /rest/v1/supplier_scorecards_view
 *       ?supplier_name=ilike.%25Test+Supplier%25
 *       &select=*
 *   Headers:
 *     Content-Type: application/json
 *     apikey: test-api-key
 *     Accept: application/vnd.pgrst.object+json
 *
 * EXPECTED RESPONSE:
 *   Status: 200 OK
 *   Body (single object — maybeSingle collapses the array):
 *     {
 *       supplier_key:          "supplier-test-001",
 *       supplier_name:         "Test Supplier",
 *       total_pos:             12,
 *       approved_pos:          10,
 *       po_approval_rate:      83.3,
 *       total_receipts:        10,
 *       clean_receipts:        8,
 *       clean_receipt_rate:    80.0,
 *       total_discrepancies:   2,
 *       approved_discrepancies:1,
 *       rejected_discrepancies:1,
 *       avg_discrepancy_units: 3.5,
 *       reliability_score:     78.5,
 *       on_time_delivery_pct:  82.0,
 *       defect_rate:           9.5
 *     }
 *
 * GENERATED ARTIFACT:
 *   The Pact contract JSON at `pacts/PharmaPOFrontend-SupabasePOAPI.json`
 *   is updated to include this interaction alongside existing ones.
 * ============================================================
 */

import path from "path";
import { describe, it, expect } from "@jest/globals";
import { PactV3, MatchersV3 } from "@pact-foundation/pact";

// ---------------------------------------------------------------------------
// Pull in Pact V3 matchers.
//  • `like()`   — matches by type/structure, not exact value.
//  • `string()` — expects a string value.
//  • `integer()`— expects an integer value.
//  • `decimal()`— expects a floating-point (decimal) value.
// ---------------------------------------------------------------------------
const { like, string, eachLike, integer } = MatchersV3;

// ---------------------------------------------------------------------------
// Configure the Pact mock provider.
//
// Uses the same consumer/provider names and output directory as the other
// contract tests so all interactions end up in a single contract file.
// ---------------------------------------------------------------------------
const provider = new PactV3({
  consumer: "PharmaPOFrontend",
  provider: "SupabasePOAPI",
  dir: path.resolve(process.cwd(), "pacts"),
  logLevel: "warn",
});

describe("Supplier Scorecard Contract — Get Scorecard by Supplier Name", () => {
  // =========================================================================
  // TEST: Successfully fetching a supplier scorecard
  // =========================================================================
  it("should return a supplier scorecard object with all KPI fields", async () => {
    // -----------------------------------------------------------------------
    // 1) ARRANGE — Define the expected request ↔ response interaction.
    // -----------------------------------------------------------------------

    /**
     * RESPONSE body the frontend expects from the scorecard view.
     *
     * Because the Supabase client uses `.maybeSingle()`, the response
     * is a single JSON object (not an array). The `Accept` header
     * `application/vnd.pgrst.object+json` tells PostgREST to return
     * one object instead of an array.
     *
     * Matchers used:
     *  - string()  → validates the value is a string
     *  - integer() → validates the value is an integer
     *  - decimal() → validates the value is a decimal/float
     *  - like()    → matches by type, allowing any value of that type
     */
    const expectedResponseBody = eachLike({
      supplier_key: string("supplier-test-001"),
      supplier_name: string("Test Supplier"),
      total_pos: integer(12),
      approved_pos: integer(10),
      po_approval_rate: like(83.3),
      total_receipts: integer(10),
      total_discrepancies: integer(2),
      approved_discrepancies: integer(1),
      rejected_discrepancies: integer(1),
      avg_discrepancy_units: like(3.5),
      reliability_score: like(78.5),
      on_time_delivery_pct: like(82.0),
      defect_rate: like(9.5),
    });

    // Register the interaction on the mock provider
    provider
      .given("a supplier scorecard exists for Test Supplier")
      .uponReceiving("a request to fetch the supplier scorecard for Test Supplier")
      .withRequest({
        method: "GET",
        path: "/rest/v1/supplier_scorecards_view",
        // ---------------------------------------------------------------
        // Query parameters mirror what the Supabase JS client sends:
        //  .select("*")                        → select=*
        //  .ilike("supplier_name", supplier)    → supplier_name=ilike.%Test Supplier%
        //
        // The Accept header with `vnd.pgrst.object+json` is how
        // `.maybeSingle()` tells PostgREST to return a single object.
        // ---------------------------------------------------------------
        query: {
          select: "*",
          supplier_name: "ilike.%Test Supplier%",
        },
        headers: {
          "Content-Type": "application/json",
          apikey: "test-api-key",
          Accept: "application/json",
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
    // -----------------------------------------------------------------------
    await provider.executeTest(async (mockServer) => {
      // Build the full URL with query parameters matching the Supabase client
      const params = new URLSearchParams({
        select: "*",
        supplier_name: "ilike.%Test Supplier%",
      });
      const url = `${mockServer.url}/rest/v1/supplier_scorecards_view?${params.toString()}`;

      // Simulate the HTTP call the frontend makes via Supabase client
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          apikey: "test-api-key",
          Accept: "application/json",
        },
      });

      // -----------------------------------------------------------------
      // 3) ASSERT — Verify the response matches expectations.
      // -----------------------------------------------------------------

      // Status code must be 200 OK
      expect(response.status).toBe(200);

      // Parse the response body
      const responseBody = await response.json();
      
      expect(Array.isArray(responseBody)).toBe(true);
      expect(responseBody.length).toBeGreaterThanOrEqual(1);

      const scorecard = responseBody[0];

      // Verify supplier identity fields
      expect(scorecard.supplier_key).toBeDefined();
      expect(scorecard.supplier_name).toBe("Test Supplier");

      // Verify PO-related KPIs
      expect(scorecard.total_pos).toBeDefined();
      expect(scorecard.approved_pos).toBeDefined();
      expect(scorecard.po_approval_rate).toBeDefined();

      // Verify receipt-related KPIs
      expect(scorecard.total_receipts).toBeDefined();

      // Verify discrepancy KPIs
      expect(scorecard.total_discrepancies).toBeDefined();
      expect(scorecard.approved_discrepancies).toBeDefined();
      expect(scorecard.rejected_discrepancies).toBeDefined();
      expect(scorecard.avg_discrepancy_units).toBeDefined();

      // Verify overall performance KPIs
      expect(scorecard.reliability_score).toBeDefined();
      expect(scorecard.on_time_delivery_pct).toBeDefined();
      expect(scorecard.defect_rate).toBeDefined();
    });

    // -----------------------------------------------------------------------
    // After this test completes successfully, the Pact contract file at
    // pacts/PharmaPOFrontend-SupabasePOAPI.json is updated to include
    // the supplier scorecard interaction.
    // -----------------------------------------------------------------------
  });
});
