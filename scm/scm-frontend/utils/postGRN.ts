import { postGrnDraft } from "@/lib/warehouseReceivingService";

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
  return postGrnDraft(grnDraftId, postedBy);
}
