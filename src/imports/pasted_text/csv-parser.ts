/**
 * csvParser.ts
 * Robust CSV parsing utility using PapaParse.
 * Extracts `sku` and `qty` columns, strips whitespace, and drops empty rows.
 *
 * Install dependency:  npm install papaparse @types/papaparse
 */

import Papa, { ParseResult, ParseError } from "papaparse";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CSVRow {
  sku: string;
  qty: number;
}

export interface ParseCSVResult {
  data: CSVRow[];
  skippedRows: number;      // rows dropped due to missing / invalid values
  errors: string[];         // non-fatal warnings collected during parse
}

// ─── Column aliases ───────────────────────────────────────────────────────────
// Accept common header variants so the parser isn't brittle against real-world CSVs.

const SKU_ALIASES  = ["sku", "item_code", "product_code", "barcode", "code"];
const QTY_ALIASES  = ["qty", "quantity", "count", "amount", "units"];

function findHeader(headers: string[], aliases: string[]): string | undefined {
  const normalised = headers.map((h) => h.trim().toLowerCase());
  for (const alias of aliases) {
    const idx = normalised.indexOf(alias);
    if (idx !== -1) return headers[idx]; // return the original (un-lowercased) key
  }
  return undefined;
}

// ─── Core parser ─────────────────────────────────────────────────────────────

/**
 * parseCSVFile
 * Reads a File object and returns a structured JSON array of { sku, qty } pairs.
 *
 * @param file  - The CSV File selected by the user
 * @returns     - Promise resolving to ParseCSVResult
 */
export function parseCSVFile(file: File): Promise<ParseCSVResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,           // treat first row as column headers
      skipEmptyLines: "greedy", // drop rows where every field is blank/whitespace
      transformHeader: (header: string) => header.trim(), // strip header whitespace
      transform: (value: string) => value.trim(),         // strip cell whitespace
      complete(result: ParseResult<Record<string, string>>) {
        const parseErrors: string[] = result.errors.map(
          (e: ParseError) => `Row ${e.row ?? "?"}: ${e.message}`
        );

        const headers = result.meta.fields ?? [];

        // ── Locate sku / qty columns ──────────────────────────────────────
        const skuHeader = findHeader(headers, SKU_ALIASES);
        const qtyHeader = findHeader(headers, QTY_ALIASES);

        if (!skuHeader) {
          return reject(
            new Error(
              `CSV is missing a recognised SKU column. Expected one of: ${SKU_ALIASES.join(", ")}`
            )
          );
        }
        if (!qtyHeader) {
          return reject(
            new Error(
              `CSV is missing a recognised QTY column. Expected one of: ${QTY_ALIASES.join(", ")}`
            )
          );
        }

        // ── Map & sanitise rows ───────────────────────────────────────────
        let skippedRows = 0;
        const data: CSVRow[] = [];

        result.data.forEach((row, index) => {
          const rawSku = (row[skuHeader] ?? "").trim();
          const rawQty = (row[qtyHeader] ?? "").trim();

          // Skip rows with an empty SKU
          if (!rawSku) {
            skippedRows++;
            parseErrors.push(`Row ${index + 2}: skipped — SKU is empty`);
            return;
          }

          // Parse qty as integer; reject non-numeric or negative values
          const qty = parseInt(rawQty, 10);
          if (isNaN(qty)) {
            skippedRows++;
            parseErrors.push(
              `Row ${index + 2}: skipped — QTY "${rawQty}" is not a valid number (SKU: ${rawSku})`
            );
            return;
          }
          if (qty < 0) {
            skippedRows++;
            parseErrors.push(
              `Row ${index + 2}: skipped — QTY ${qty} is negative (SKU: ${rawSku})`
            );
            return;
          }

          data.push({ sku: rawSku, qty });
        });

        resolve({ data, skippedRows, errors: parseErrors });
      },
      error(error: Error) {
        reject(new Error(`PapaParse failed to read file: ${error.message}`));
      },
    });
  });
}

// ─── Convenience: parse from raw CSV string (for unit-testing) ────────────────

export function parseCSVString(csvText: string): ParseCSVResult {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h: string) => h.trim(),
    transform: (v: string) => v.trim(),
  });

  const headers = result.meta.fields ?? [];
  const skuHeader = findHeader(headers, SKU_ALIASES);
  const qtyHeader = findHeader(headers, QTY_ALIASES);

  if (!skuHeader || !qtyHeader) {
    throw new Error("CSV string is missing required sku / qty columns.");
  }

  const errors: string[] = result.errors.map(
    (e) => `Row ${e.row ?? "?"}: ${e.message}`
  );
  let skippedRows = 0;
  const data: CSVRow[] = [];

  result.data.forEach((row, index) => {
    const rawSku = (row[skuHeader] ?? "").trim();
    const rawQty = (row[qtyHeader] ?? "").trim();

    if (!rawSku) { skippedRows++; return; }

    const qty = parseInt(rawQty, 10);
    if (isNaN(qty) || qty < 0) {
      skippedRows++;
      errors.push(`Row ${index + 2}: invalid QTY "${rawQty}" for SKU "${rawSku}"`);
      return;
    }

    data.push({ sku: rawSku, qty });
  });

  return { data, skippedRows, errors };
}