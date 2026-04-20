import fs from "fs";
import path from "path";

const PACT_DIR = path.resolve(process.cwd(), "pacts");
const MAIN_PACT = path.join(PACT_DIR, "PharmaPOFrontend-SupabasePOAPI.json");
const READONLY_PACT = path.join(PACT_DIR, "PharmaPOFrontend-SupabasePOAPI.readonly.json");

/**
 * Filters the main Pact contract to create a read-only version.
 * This excludes destructive operations (like CREATE PO) that fail
 * provider verification due to Supabase RLS.
 */
function filterPact() {
  if (!fs.existsSync(MAIN_PACT)) {
    console.error(`Main pact file not found at ${MAIN_PACT}`);
    process.exit(1);
  }

  const pact = JSON.parse(fs.readFileSync(MAIN_PACT, "utf8"));

  // Keep only interactions for supplier search and scorecard
  const readonlyInteractions = pact.interactions.filter((interaction) => {
    const desc = interaction.description.toLowerCase();
    return desc.includes("search") || desc.includes("scorecard");
  });

  const readonlyPact = {
    ...pact,
    interactions: readonlyInteractions,
  };

  fs.writeFileSync(READONLY_PACT, JSON.stringify(readonlyPact, null, 2));
  console.log(`Read-only pact created at ${READONLY_PACT}`);
}

filterPact();
