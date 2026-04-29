import { createClient } from '@supabase/supabase-js';

export default async function globalTeardown() {
  console.log("\nCleaning up integration test environment...");

  const supabaseUrl = process.env.BASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('SUPABASE_URL or SUPABASE_ANON_KEY not set. Skipping DB cleanup.');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Cleaning up test database...');

  // Delete test data
  // Delete in reverse order to avoid foreign key constraints

  // Delete suppliers
  const { error: supplierDeleteError } = await supabase
    .from('suppliers')
    .delete()
    .in('id', ['test-supplier-1', 'test-supplier-2']);

  if (supplierDeleteError) {
    console.error('Error deleting suppliers:', supplierDeleteError);
  }

  // Delete any other test data inserted during tests
  // For example, qc_inspections, purchase_orders, etc.
  // Since tests insert with timestamps or unique notes, we can delete based on that

  const { error: qcDeleteError } = await supabase
    .from('qc_inspections')
    .delete()
    .like('notes', 'Integration Test%');

  if (qcDeleteError) {
    console.error('Error deleting QC inspections:', qcDeleteError);
  }

  const { error: poDeleteError } = await supabase
    .from('purchase_orders')
    .delete()
    .eq('supplier_name', 'Test High-Value Supplier');

  if (poDeleteError) {
    console.error('Error deleting purchase orders:', poDeleteError);
  }

  console.log('Test database cleaned up.');
}
