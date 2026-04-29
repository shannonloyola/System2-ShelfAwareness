import { createClient } from '@supabase/supabase-js';

export default async function globalSetup() {
  console.log("\nStarting integration test environment...");

  const supabaseUrl = process.env.BASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('SUPABASE_URL or SUPABASE_ANON_KEY not set. Skipping DB setup.');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Seed test data
  console.log('Seeding test database...');

  // Insert sample suppliers
  const { error: supplierError } = await supabase
    .from('suppliers')
    .upsert([
      {
        id: 'test-supplier-1',
        supplier_name: 'Test Supplier 1',
        contact_person: 'John Doe',
        email: 'john@test.com',
        phone: '+1234567890',
        address: '123 Test St',
        currency_code: 'USD',
        lead_time_days: 7,
        status: 'Active'
      },
      {
        id: 'test-supplier-2',
        supplier_name: 'Test Supplier 2',
        contact_person: 'Jane Smith',
        email: 'jane@test.com',
        phone: '+0987654321',
        address: '456 Test Ave',
        currency_code: 'EUR',
        lead_time_days: 10,
        status: 'Active'
      }
    ]);

  if (supplierError) {
    console.error('Error seeding suppliers:', supplierError);
  } else {
    console.log('Suppliers seeded successfully');
  }

  // Insert sample QC inspections
  const { error: qcError } = await supabase
    .from('qc_inspections')
    .upsert([
      {
        id: 'test-qc-1',
        result: 'Pass',
        notes: 'Test QC inspection',
        reported_by: 'Test Agent'
      },
      {
        id: 'test-qc-2',
        result: 'Fail',
        notes: 'Test QC failure',
        reported_by: 'Test Agent'
      }
    ]);

  if (qcError) {
    console.error('Error seeding QC inspections:', qcError);
  } else {
    console.log('QC inspections seeded successfully');
  }

  // Insert sample purchase orders
  const { error: poError } = await supabase
    .from('purchase_orders')
    .upsert([
      {
        id: 'test-po-1',
        supplier_name: 'Test Supplier 1',
        total_value: 1000.00,
        status: 'Pending'
      }
    ]);

  if (poError) {
    console.error('Error seeding purchase orders:', poError);
  } else {
    console.log('Purchase orders seeded successfully');
  }

  // Add more seeding as needed for other tables

  console.log('Test database seeded.');
}
