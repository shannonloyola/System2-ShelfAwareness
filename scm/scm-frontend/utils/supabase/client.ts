import { createClient } from '@supabase/supabase-js';
import {
  projectId,
  publicAnonKey,
  scmProjectId,
  scmPublicAnonKey,
  fulfillmentProjectId,
  fulfillmentPublicAnonKey,
  qualityProjectId,
  qualityPublicAnonKey,
  supportIntelProjectId,
  supportIntelPublicAnonKey,
} from './info';

// Identity Client (for Auth, Profiles)
export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
);

// Supply Chain Client (for Suppliers, Procurement)
export const supabaseSCM = createClient(
  `https://${scmProjectId}.supabase.co`,
  scmPublicAnonKey
);

// Fulfillment Client (for Warehouse, Inventory, Distribution)
export const supabaseFulfillment = createClient(
  `https://${fulfillmentProjectId}.supabase.co`,
  fulfillmentPublicAnonKey
);

export const supabaseQuality = createClient(
  `https://${qualityProjectId}.supabase.co`,
  qualityPublicAnonKey
);

export const supabaseSupportIntel = createClient(
  `https://${supportIntelProjectId}.supabase.co`,
  supportIntelPublicAnonKey
);
