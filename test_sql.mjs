import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://dkqvbyewfyzfmisyisgs.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrcXZieWV3Znl6Zm1pc3lpc2dzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUwNjM4OCwiZXhwIjoyMDk0MDgyMzg4fQ.Ar2P2sV4dOYxrBd3LRER3Ke8UfKHuSOAa51ZGa6UYNI";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { query: 'SELECT 1' });
  console.log('data:', data, 'error:', error);
}

run();
