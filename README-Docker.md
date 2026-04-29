# Docker Setup for Pharma Project

This project is fully containerized using Docker and Docker Compose. It includes 16 application services and additional infrastructure for monitoring and data storage.

## Prerequisites
- [Docker](https://www.docker.com/products/docker-desktop) (with Docker Compose support)

## First-time Setup
1. **Prepare Environment Variables**:
   Copy the `.env.example` file to `.env` in the root directory.
   ```bash
   cp .env.example .env
   ```
2. **Fill in Required Credentials**:
   Edit the `.env` file and provide your Supabase credentials. The project relies on an external Supabase instance.
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `DATABASE_URL`

## Running the Project

### 1. Build the Images
```bash
npm run docker:build
```

### 2. Start the Services
```bash
npm run docker:up
```

### 3. View Status
```bash
npm run docker:ps
```

### 4. View Logs
```bash
npm run docker:logs
```

### 5. Stop the Project
```bash
npm run docker:down
```

## Service Map & Ports

| Service Name | Port | Description |
| :--- | :--- | :--- |
| **pharma-frontend** | 5173 | Next.js Web Frontend |
| **pharma-backend** | 3001 | NestJS Backend Gateway |
| **supplier-service** | 4001 | Supplier management |
| **procurement-service** | 4002 | Procurement workflows |
| **product-catalog-service** | 4003 | Master product data |
| **inventory-service** | 4004 | Inventory tracking |
| **warehouse-receiving-service** | 4005 | Warehouse operations |
| **distribution-service** | 4006 | Distribution logistics |
| **discrepancy-qc-service** | 4007 | Quality control |
| **stock-adjustment-service** | 4008 | Inventory corrections |
| **cycle-counting-service** | 4009 | Inventory auditing |
| **risk-compliance-service** | 4010 | Risk assessment & cron jobs |
| **notification-service** | 4011 | System notifications |
| **reporting-analytics-service** | 4012 | Analytical reports |
| **document-service** | 4013 | Document storage & metadata |
| **auth-user-access-service** | 4014 | Auth & permissions |
| **influxdb** | 8086 | Performance metrics storage |
| **grafana** | 3000 | Monitoring dashboards |

## Network & Communication
- **Internal DNS**: Services communicate internally using their Docker service names (e.g., `http://supplier-service:4001`).
- **Browser Access**: The frontend calls the backend/services via `localhost` mapped ports. Ensure `NEXT_PUBLIC_BACKEND_API_URL` is set to `http://localhost:3001` in your `.env`.

## Troubleshooting
- **Build Errors**: Ensure you are in the root directory. Run `docker compose build --no-cache` if you encounter persistent build issues.
- **Connection Issues**: Verify your `.env` contains valid Supabase credentials. The services will fail health checks if they cannot reach the database.
- **Port Conflicts**: Ensure ports 3000, 3001, 5173, and 4001-4014 are not being used by other local processes.

## Notes
- **Supabase**: This is an external dependency and is not containerized.
- **Health Checks**: Most microservices include Docker health checks that verify the `/health` endpoint every 30 seconds.
