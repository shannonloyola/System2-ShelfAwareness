# Grafana & k6 Monitoring Setup

This guide explains how to set up a local monitoring stack using InfluxDB and Grafana to visualize your k6 performance test results.

## 1. Start the Monitoring Stack

Ensure you have Docker and Docker Compose installed. Run the following command from the project root:

```bash
docker-compose up -d
```

This will start:
- **InfluxDB** on `http://localhost:8086`
- **Grafana** on `http://localhost:3000`

## 2. Run k6 with InfluxDB Output

To send metrics to InfluxDB while running your tests, use the `--out influxdb` flag:

```bash
k6 run \
  -e BASE_URL=https://<your-project-id>.supabase.co \
  -e SUPABASE_ANON_KEY=<your-anon-key> \
  --out influxdb=http://localhost:8086/k6 \
  tests/performance/k6-endpoints.js
```

## 3. Visualize in Grafana

1. Open your browser and go to `http://localhost:3000`.
2. **Login Credentials**:
   - **Username**: `admin`
   - **Password**: `admin`
3. The InfluxDB datasource is already pre-configured via provisioning.
4. You can now create a new dashboard or import a k6 dashboard (e.g., [k6 official dashboard](https://grafana.com/grafana/dashboards/2587-k6-load-testing-results/)) to visualize the data in the `k6` database.

## 4. Stopping the Services

To stop and remove the monitoring containers, run:

```bash
docker-compose down
```
