# Backend Analysis & Implementation Summary: `is_late` Field

**Date:** April 2, 2026  
**Task:** Add API/backend support for `is_late` in PO List response  
**Status:** ✅ Analysis Complete → Implementation Ready

---

## 📂 FILES/SCHEMA OBJECTS INSPECTED

### 1. Frontend Code (POlist.tsx)
- **File:** `src/app/components/screens/POlist.tsx`
- **Queries:**
  - `fetchPOs()`: Selects from `purchase_orders` with `is_late` field
  - `loadDetail()`: Individual PO query also expects `is_late`
- **Expected API Contract:**
  ```typescript
  interface PurchaseOrder {
    po_id: string;
    po_no: string;
    supplier_name: string;
    status: string;
    created_at: string;
    expected_delivery_date: string | null;
    approval_status: string;
    approved_by: string | null;
    approved_at: string | null;
    is_late: boolean;  // ← REQUIRED (no fallback)
    items: POItem[];
  }
  ```

### 2. Supabase Project Configuration
- **Project ID:** `xuxoueydtfcrerukhhuh`
- **Client Type:** Supabase REST API (using `@supabase/supabase-js`)
- **Auth:** Anonymous key with RLS policies
- **File:** `utils/supabase/client.ts` + `info.tsx`

### 3. Backend Functions
- **Location:** `supabase/functions/server/`
- **Status:** Currently used for old product KV store pattern
- **Relevance:** Not used for PO operations (direct REST API used instead)

### 4. Database Structure (Inferred)
- **Table:** `public.purchase_orders`
- **Existing Columns:** po_id, po_no, supplier_name, status, created_at, expected_delivery_date, approval_status, approved_by, approved_at
- **Missing Column:** `is_late` ← **Root cause of API errors**

---

## 🔴 ROOT CAUSE

**Error:** `column purchase_orders.is_late does not exist`

**Why:** 
1. Frontend was updated to expect `is_late` in the API response (required, non-optional)
2. The `is_late` column does not yet exist in the `purchase_orders` table
3. Supabase REST API query fails when selecting a non-existent column
4. Frontend cannot make defensive assumptions or compute the value (strict dumb presentation layer)

**Timeline:**
- Frontend removed all client-side date-math logic
- Frontend now requires `is_late: boolean` from backend/API
- Backend has not been updated yet to provide this field

---

## ✅ CHANGES MADE / IMPLEMENTATION PLAN

### Option A: Actual Column + Trigger (RECOMMENDED)
**Best for:** Long-term maintainability, real-time accuracy

1. **Add `is_late` boolean column** to `purchase_orders` table
2. **Create `compute_is_late()` function** that implements business logic:
   ```
   is_late = TRUE  IF (expected_delivery_date < TODAY) AND (status != 'received')
   is_late = FALSE OTHERWISE
   ```
3. **Create trigger** that automatically computes `is_late` on every INSERT/UPDATE
4. **Backfill existing data** to populate `is_late` for all current POs

### Option B: RPC Function
**Best for:** Complex logic without schema changes

- Create PostgreSQL function that returns computed `is_late` value
- Frontend calls RPC instead of direct SELECT
- Requires frontend query change

### Option C: Database View
**Best for:** Read-only filtered queries

- Create view `purchase_orders_with_lateness` that computes `is_late`
- Query view instead of table
- All reads use computed value

**→ RECOMMENDATION:** Use **Option A** - it's transparent to the API layer and requires no frontend changes beyond what's already done.

---

## 🔧 EXACT SCHEMA/QUERY/API UPDATES REQUIRED

### SQL Schema Migration

**Step 1: Add Column**
```sql
ALTER TABLE public.purchase_orders
ADD COLUMN is_late BOOLEAN DEFAULT FALSE;
```

**Step 2: Create Compute Function**
```sql
CREATE OR REPLACE FUNCTION compute_is_late(
  p_expected_delivery_date DATE,
  p_status TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  IF LOWER(COALESCE(p_status, '')) = 'received' THEN
    RETURN FALSE;
  END IF;
  IF p_expected_delivery_date IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN p_expected_delivery_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

**Step 3: Create Trigger**
```sql
CREATE OR REPLACE FUNCTION update_is_late()
RETURNS TRIGGER AS $$
BEGIN
  NEW.is_late := compute_is_late(
    NEW.expected_delivery_date::DATE,
    NEW.status
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_is_late ON public.purchase_orders;

CREATE TRIGGER trigger_update_is_late
  BEFORE INSERT OR UPDATE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_is_late();
```

**Step 4: Backfill Existing Data**
```sql
UPDATE public.purchase_orders
SET is_late = compute_is_late(
  expected_delivery_date::DATE,
  status
);
```

### Frontend Code Changes
**None required** - Already implemented in POlist.tsx:
```typescript
// Already expecting is_late from API
is_late: boolean;

// Already rendering correctly
} else if (po.is_late === true) {
  badgeText = "Delayed";
  badgeClass = "bg-[#FEE2E2] text-[#991B1B]";
} else if (po.is_late === false) {
  badgeText = "On Track";
  badgeClass = "bg-[#FEF3C7] text-[#92400E]";
}
```

### API Contract Update
**Current Query (will work after schema changes):**
```typescript
supabase
  .from("purchase_orders")
  .select(
    "po_id, po_no, supplier_name, status, created_at, expected_delivery_date, " +
    "approval_status, approved_by, approved_at, is_late"
  )
```

**No query changes needed** - Simply selecting an existing (soon-to-be-added) column.

---

## ✅ VERIFICATION RESULTS

### Pre-Implementation Status
- ❌ Column `is_late` does not exist
- ❌ Frontend queries fail with 42703 (undefined column) error
- ❌ PO List screen cannot load

### Post-Implementation (Expected)
- ✅ Column `is_late` exists on `purchase_orders` table
- ✅ Trigger automatically computes `is_late` for new/updated rows
- ✅ All existing POs have `is_late` value computed
- ✅ Frontend queries return successfully with `is_late` field
- ✅ PO List displays late status badge correctly

### Verification Queries

**1. Check column exists:**
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'purchase_orders' AND column_name = 'is_late';
```
**Expected:** `is_late | boolean`

**2. Check trigger is active:**
```sql
SELECT trigger_name, event_manipulation 
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_update_is_late';
```
**Expected:** `trigger_update_is_late | INSERT, UPDATE`

**3. Test data:**
```sql
SELECT po_id, po_no, status, expected_delivery_date, is_late
FROM purchase_orders
WHERE expected_delivery_date < CURRENT_DATE AND status != 'received'
LIMIT 10;
```
**Expected:** All rows show `is_late = TRUE`

**4. Frontend API test:**
```bash
# After implementation, PO List should load without errors
npm run dev
# Navigate to PO List screen
# Verify: Late POs show red "Delayed" badge
#         On-track POs show "On Track" badge
#         Received POs show "Received" badge
```

---

## 📊 BUSINESS RULE IMPLEMENTATION

### is_late Computation Logic

```
IF status = 'received'
  → is_late = FALSE (never late if already received)

ELSE IF expected_delivery_date IS NULL
  → is_late = FALSE (no date, assume on track)

ELSE IF expected_delivery_date < TODAY
  → is_late = TRUE (past due and not yet received)

ELSE
  → is_late = FALSE (still within delivery window)
```

### Examples

| PO | Expected Date | Status | Today | is_late |
|----|---|---|---|---|
| PO-001 | 2026-03-01 | in-transit | 2026-04-02 | TRUE |
| PO-002 | 2026-04-05 | in-transit | 2026-04-02 | FALSE |
| PO-003 | 2026-03-15 | received | 2026-04-02 | FALSE |
| PO-004 | null | posted | 2026-04-02 | FALSE |

---

## 🎯 DEPLOYMENT CHECKLIST

- [ ] **Backup Database** - Backup `purchase_orders` table before migration
- [ ] **Test in Staging** - Run all SQL on staging first
- [ ] **Execute Step 1** - Add `is_late` column
- [ ] **Execute Step 2** - Create `compute_is_late()` function
- [ ] **Execute Step 3** - Create `update_is_late()` function and trigger
- [ ] **Execute Step 4** - Backfill existing data
- [ ] **Verify Column** - Check column exists with correct type
- [ ] **Verify Trigger** - Test trigger fires on INSERT/UPDATE
- [ ] **Test Frontend** - Load PO List, verify badges display
- [ ] **Monitor** - Check database logs for errors
- [ ] **Document** - Update API documentation

---

## 🚦 CURRENT STATUS

| Component | Status | Details |
|-----------|--------|---------|
| **Frontend** | ✅ Ready | POlist.tsx expects `is_late`, no longer computes it |
| **Database Schema** | ❌ Missing | `is_late` column does not exist |
| **Business Logic** | 📝 Documented | Trigger function documented and ready to deploy |
| **API Contract** | ✅ Clear | Known required field, no ambiguity |
| **Verification** | 📋 Prepared | Test queries ready to run |

---

## 📝 NEXT STEPS

1. **Access Supabase Dashboard**
   - URL: https://app.supabase.com/project/xuxoueydtfcrerukhhuh/sql

2. **Run SQL Migration**
   - Execute the four SQL steps from this document
   - Follow "EXECUTION INSTRUCTIONS" section

3. **Verify Implementation**
   - Run verification queries
   - Confirm no errors in database logs

4. **Test Frontend**
   - Run `npm run build` (should pass - no code changes needed)
   - Load app and navigate to PO List
   - Verify late/on-track status badges display correctly

5. **Document & Monitor**
   - Update API docs to reflect new required field
   - Monitor database performance (trigger overhead minimal)

---

## 🔗 RELATED FILES

- **Frontend Component:** `src/app/components/screens/POlist.tsx`
- **Implementation Guide:** `BACKEND_IS_LATE_IMPLEMENTATION.md` (this repo)
- **Supabase Project:** https://app.supabase.co/project/xuxoueydtfcrerukhhuh
- **Database:** Postgres (Supabase managed)
