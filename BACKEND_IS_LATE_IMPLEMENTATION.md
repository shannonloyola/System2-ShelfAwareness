# Backend Implementation: `is_late` Field for PO List API

**Date:** April 2, 2026  
**Component:** Purchase Orders - Backend Support for `is_late` Field  
**Status:** Implementation Guide

---

## 🎯 OBJECTIVE

Add `is_late` as a required boolean field to the `purchase_orders` table so the PO List frontend (which no longer computes lateness client-side) can properly display the delayed status badge from API data.

---

## 📋 ANALYSIS

### Current Frontend Requirement
The frontend PO List component now queries:
```sql
SELECT po_id, po_no, supplier_name, status, created_at, expected_delivery_date, 
       approval_status, approved_by, approved_at, is_late
FROM purchase_orders
```

**Current Error:** `column purchase_orders.is_late does not exist`

### Business Logic for `is_late`
A PO is considered **late** when:
- `expected_delivery_date` is in the past (before today)
- **AND** `status` is NOT 'received' (completed POs are not "late")

### Design Decision: Computed Column vs. RPC vs. Trigger

| Option | Pros | Cons |
|--------|------|------|
| **Actual Column + Trigger** | Simple SELECT; always in sync | Requires trigger maintenance |
| **Generated Column** | Automatic; always current | Not supported for boolean logic in older PostgreSQL |
| **RPC Function** | Clean separation; logic in DB | Requires different query pattern |
| **Simple Column + Manual Updates** | Minimal changes | Logic lives in application layer |

✅ **Recommended:** Add actual `is_late` boolean column with a **trigger function** to compute it on insert/update.

---

## 🔧 IMPLEMENTATION STEPS

### Step 1: Add `is_late` Column to `purchase_orders` Table

```sql
-- Add the is_late boolean column (default: false)
ALTER TABLE public.purchase_orders
ADD COLUMN is_late BOOLEAN DEFAULT FALSE;
```

### Step 2: Create Helper Function to Compute `is_late`

```sql
-- Function to determine if a PO is late
CREATE OR REPLACE FUNCTION compute_is_late(
  p_expected_delivery_date DATE,
  p_status TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  -- If already received, not late
  IF LOWER(COALESCE(p_status, '')) = 'received' THEN
    RETURN FALSE;
  END IF;
  
  -- If expected_delivery_date is null, not late
  IF p_expected_delivery_date IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Compare with today (without time component)
  -- Late if expected date < today
  RETURN p_expected_delivery_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

### Step 3: Create Trigger to Auto-Update `is_late`

```sql
-- Trigger function to update is_late before insert/update
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

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_is_late ON public.purchase_orders;

-- Create trigger on INSERT and UPDATE
CREATE TRIGGER trigger_update_is_late
  BEFORE INSERT OR UPDATE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_is_late();
```

### Step 4: Populate `is_late` for Existing Records

```sql
-- Update all existing PO records with computed is_late value
UPDATE public.purchase_orders
SET is_late = compute_is_late(
  expected_delivery_date::DATE,
  status
)
WHERE is_late IS NULL OR is_late = FALSE;
```

---

## 🚀 EXECUTION INSTRUCTIONS

### In Supabase Dashboard:

1. **Open SQL Editor**
   - Navigate to: https://app.supabase.com/project/xuxoueydtfcrerukhhuh/sql/new
   - (Or: Dashboard → SQL Editor → New Query)

2. **Run Step 1: Add Column**
   ```sql
   ALTER TABLE public.purchase_orders
   ADD COLUMN is_late BOOLEAN DEFAULT FALSE;
   ```

3. **Run Step 2: Create Helper Function**
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

4. **Run Step 3: Create Trigger**
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

5. **Run Step 4: Populate Existing Data**
   ```sql
   UPDATE public.purchase_orders
   SET is_late = compute_is_late(
     expected_delivery_date::DATE,
     status
   );
   ```

---

## ✅ VERIFICATION

### Test 1: Verify Column Exists
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'purchase_orders' AND column_name = 'is_late';
```
**Expected Result:** `is_late | boolean`

### Test 2: Test Trigger with Sample Data
```sql
-- Create a test PO (expected delivery yesterday, status not 'received')
INSERT INTO public.purchase_orders 
(po_no, supplier_name, status, expected_delivery_date)
VALUES 
('TEST-001', 'Test Supplier', 'in-transit', CURRENT_DATE - INTERVAL '1 day');

-- Query to verify is_late is set correctly
SELECT po_no, status, expected_delivery_date, is_late 
FROM public.purchase_orders 
WHERE po_no = 'TEST-001';
```
**Expected Result:** `is_late = TRUE` (since date is in past and status != 'received')

### Test 3: Test Frontend Query
```sql
SELECT po_id, po_no, supplier_name, status, created_at, expected_delivery_date, 
       approval_status, approved_by, approved_at, is_late
FROM public.purchase_orders
LIMIT 5;
```
**Expected Result:** All rows have `is_late` column with boolean values

### Test 4: Test RLS Permissions
Ensure that the `is_late` column is accessible with the project's current RLS policy:
```sql
-- Check if anon role can read is_late
SELECT is_late FROM public.purchase_orders LIMIT 1;
```
**Expected Result:** Query succeeds with no permission errors

---

## 🔄 DATA CONSISTENCY RULES

Once implemented, the following rules will be enforced automatically:

| Scenario | Expected `is_late` Value |
|----------|--------------------------|
| Status = 'received' | `FALSE` (always, even if past due) |
| Status ≠ 'received' AND expected_delivery_date IS NULL | `FALSE` |
| Status ≠ 'received' AND expected_delivery_date < TODAY | `TRUE` |
| Status ≠ 'received' AND expected_delivery_date ≥ TODAY | `FALSE` |

---

## 🛡️ SAFETY CHECKS

Before running in production:

- [ ] Backup `purchase_orders` table data
- [ ] Test on staging/dev database first
- [ ] Verify no RLS policies block the `is_late` column reads
- [ ] Confirm trigger fires correctly on test inserts/updates
- [ ] Check that frontend queries now succeed without errors

---

## 📌 FOLLOW-UP TASKS

1. **After SQL Migration Completes:**
   - Frontend will automatically receive `is_late` in PO List queries
   - No code changes needed on frontend (already implemented)

2. **Testing:**
   - Run `npm run build` to confirm no TypeScript errors
   - Load PO List screen and verify:
     - Red "Delayed" badge appears for late POs
     - Badge does NOT appear for "On Track" or "Received" POs
     - Badge does NOT appear if `is_late` is missing (fails strict)

3. **Documentation:**
   - Update API contract docs to include `is_late` as required field
   - Document the business rule in schema/ER diagrams

4. **Monitoring:**
   - Monitor database logs for trigger errors
   - Track performance of computed column queries

---

## 🚨 ROLLBACK PLAN

If issues occur:

```sql
-- Remove the trigger
DROP TRIGGER IF EXISTS trigger_update_is_late ON public.purchase_orders;
DROP FUNCTION IF EXISTS update_is_late();
DROP FUNCTION IF EXISTS compute_is_late(DATE, TEXT);

-- Remove the column
ALTER TABLE public.purchase_orders DROP COLUMN is_late;

-- Frontend will show no late-status badge (stricter fail-safe)
```

---

## 📚 REFERENCES

- **Frontend Component:** `src/app/components/screens/POlist.tsx`
- **API Query:** Selects `is_late` from `purchase_orders`
- **Business Rule:** Late = (expected_delivery_date < today) AND (status != 'received')
- **Type Definition:** `PurchaseOrder` interface requires `is_late: boolean`
