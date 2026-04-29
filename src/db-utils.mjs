/**
 * Database utilities for test seed/teardown operations
 */

export const dbConfig = {
  tables: {
    suppliers: 'suppliers',
    qcInspections: 'qc_inspections',
    purchaseOrders: 'purchase_orders'
  },
  coverageThreshold: {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70
  }
};

export async function seedDatabase(supabase) {
  if (!supabase) {
    console.warn('Supabase client not available');
    return false;
  }
  
  try {
    // Seed suppliers
    await supabase.from(dbConfig.tables.suppliers).upsert([
      {
        id: 'test-supplier-1',
        supplier_name: 'Test Supplier',
        currency_code: 'USD',
        lead_time_days: 7
      }
    ]);
    
    return true;
  } catch (error) {
    console.error('Error seeding database:', error);
    return false;
  }
}

export async function teardownDatabase(supabase) {
  if (!supabase) {
    console.warn('Supabase client not available');
    return false;
  }
  
  try {
    // Clean up test data
    await supabase
      .from(dbConfig.tables.suppliers)
      .delete()
      .in('id', ['test-supplier-1']);
    
    return true;
  } catch (error) {
    console.error('Error tearing down database:', error);
    return false;
  }
}

export function getTestConfig() {
  return {
    testEnvironment: 'node',
    collectCoverage: true,
    coverageThreshold: dbConfig.coverageThreshold
  };
}
