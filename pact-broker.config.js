/**
 * Pact Broker Configuration
 * 
 * This configures publishing and verification of pacts to/from a Pact Broker.
 * For demo purposes, we'll use the free PactFlow public broker.
 */

export const pactBrokerConfig = {
  // Using PactFlow free public broker for demonstration
  brokerUrl: "https://test.pactflow.io",
  
  // Authentication token (for PactFlow)
  // In production, use environment variables
  brokerToken: process.env.PACT_BROKER_TOKEN || "",
  
  // Consumer configuration
  consumer: {
    name: "PharmaPOFrontend",
    version: process.env.GIT_SHA || "local-dev",
    branch: process.env.GIT_BRANCH || "main",
  },
  
  // Provider configuration
  providers: {
    SupplierService: {
      name: "SupplierService",
      version: process.env.GIT_SHA || "local-dev",
      branch: process.env.GIT_BRANCH || "main",
    },
    SupabasePOAPI: {
      name: "SupabasePOAPI", 
      version: process.env.GIT_SHA || "local-dev",
      branch: process.env.GIT_BRANCH || "main",
    }
  },
  
  // Publishing options
  publishOptions: {
    // Build tags for CI/CD integration
    tags: ["dev", "test"],
    
    // Environment information
    environment: process.env.NODE_ENV || "test",
    
    // Build URL for linking back to CI
    buildUrl: process.env.CI_BUILD_URL || "",
  }
};

// Export for use in test files
export default pactBrokerConfig;
