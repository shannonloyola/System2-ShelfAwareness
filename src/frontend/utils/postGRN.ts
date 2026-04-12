import { projectId, publicAnonKey } from "./supabase/info";

export interface PostGRNResult {
  grn_id: string;
  grn_number: string;
  lines_processed: number;
  products_updated: number;
  movements_inserted: number;
  posted_by: string;
  posted_at: string;
  status: "POSTED";
}

/**
 * Calls the `post_grn_draft` Supabase RPC to:
 *  - validate at least 1 line item exists
 *  - require discrepancy reasons on mismatched lines
 *  - set status to POSTED
 *  - upsert qty_received into inventory_on_hand for each line
 *  - insert a GRN_RECEIPT row into inventory_movements with stock_before/after
 *  - stamp posted_by + posted_at
 *
 * Throws a descriptive Error on any failure so callers can surface it in the UI.
 */
export async function postGRN(
  grnDraftId: string,
  postedBy: string = "warehouse_operator",
): Promise<PostGRNResult> {
  const url = `https://${projectId}.supabase.co/rest/v1/rpc/post_grn_draft`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: publicAnonKey,
      Authorization: `Bearer ${publicAnonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_grn_draft_id: grnDraftId,
      p_posted_by: postedBy,
    }),
  });

  const text = await res.text();

  if (!res.ok) {
    // Supabase wraps DB exceptions in { message, hint, details, code }
    let message = `HTTP ${res.status}`;
    try {
      const err = JSON.parse(text);
      message = err.message ?? err.hint ?? text;
    } catch {
      message = text || message;
    }
    throw new Error(message);
  }

  let data: PostGRNResult;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Unexpected response from post_grn_draft: ${text}`,
    );
  }

  // The RPC returns { success: true, ... } on success.
  // If success is explicitly false, surface the error field.
  if ((data as any).success === false) {
    throw new Error(
      (data as any).error ??
        "post_grn_draft returned success: false",
    );
  }

  return data;
}