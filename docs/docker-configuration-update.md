# Docker Configuration Update - SCM-S5-006-T2

## 🎯 Objective
Update Dockerfiles and docker-compose paths to support the new frontend/backend workflow split and improve containerization strategy.

## ✅ Implementation Complete

### 📁 Updated Docker Files

#### 1. Frontend Dockerfile
**File**: `Dockerfile.frontend`

**Features**:
- Multi-stage build (builder + production)
- Nginx-based serving with static assets
- Optimized for production with gzip compression
- Health checks and proper signal handling
- Security headers and API proxy configuration

**Build Context**: Root directory
**Target**: Production-ready static web server

#### 2. Backend Dockerfile (Updated)
**File**: `services/supplier-service/Dockerfile`

**Improvements**:
- Multi-stage build for optimization
- Non-root user execution (nodejs:1001)
- Proper signal handling with dumb-init
- Health checks for container monitoring
- Security hardening and minimal attack surface
- Optimized layer caching and dependency management

**Build Context**: `services/supplier-service/`
**Target**: Production Node.js application

#### 3. Docker Compose Configuration (Updated)
**File**: `docker-compose.yml`

**New Services Added**:
- `frontend`: React application with Nginx
- `backend`: Supplier service API
- `postgres`: PostgreSQL database
- `redis`: Redis cache layer
- `k6`: Performance testing (profile-based)

**Updated Services**:
- `influxdb`: Performance metrics storage
- `grafana`: Monitoring dashboard (port changed to 3001)

**Network Configuration**:
- Shared `pharma-network` for service communication
- Proper service dependencies and startup order
- Volume mounts for data persistence

### 🔧 Path Updates and Improvements

#### Build Contexts
```yaml
# Frontend build context
frontend:
  build:
    context: .
    dockerfile: Dockerfile.frontend

# Backend build context
backend:
  build:
    context: ./services/supplier-service
    dockerfile: Dockerfile
```

#### Volume Mounts
```yaml
# Database schema initialization
postgres:
  volumes:
    - ./suppliers_schema.sql:/docker-entrypoint-initdb.d/01-suppliers.sql
    - ./payments_schema.sql:/docker-entrypoint-initdb.d/02-payments.sql
    - ./risk_assessments_schema.sql:/docker-entrypoint-initdb.d/03-risk-assessments.sql
    - ./delivery_schedules_schema.sql:/docker-entrypoint-initdb.d/04-delivery-schedules.sql

# Backend development volumes
backend:
  volumes:
    - ./services/supplier-service/src:/app/src
    - ./services/supplier-service/package.json:/app/package.json
```

#### Port Mappings
- Frontend: `3000:3000` (Nginx)
- Backend: `4001:4001` (Node.js API)
- PostgreSQL: `5432:5432`
- Redis: `6379:6379`
- Grafana: `3001:3000` (changed from 3000 to avoid conflict)
- InfluxDB: `8086:8086`

### 🛡️ Security Enhancements

#### Frontend Security
- Non-root Nginx execution
- Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
- API proxy with proper headers
- Static asset caching with immutable headers

#### Backend Security
- Non-root user (nodejs:1001)
- Minimal Alpine Linux base
- Production-only dependencies
- Health checks for monitoring
- Proper signal handling with dumb-init

#### Network Security
- Isolated bridge network (`pharma-network`)
- Service-to-service communication via container names
- No direct host port exposure for internal services

### 📊 Performance Optimizations

#### Build Optimization
- Multi-stage builds reduce final image size
- .dockerignore files exclude unnecessary files
- Layer caching with proper COPY order
- Parallel build capabilities

#### Runtime Optimization
- Nginx gzip compression for frontend
- Redis caching layer for backend
- Connection pooling and keep-alive
- Health checks for load balancer integration

### 🔧 Environment Configuration

#### Frontend Environment
```yaml
environment:
  - NODE_ENV=production
```

#### Backend Environment
```yaml
environment:
  - NODE_ENV=production
  - PORT=4001
  - DATABASE_URL=${DATABASE_URL:-postgresql://postgres:password@postgres:5432/supplier_db}
  - SUPABASE_URL=${SUPABASE_URL}
  - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
```

### 📋 .dockerignore Files

#### Root .dockerignore
Excludes frontend development files:
- `node_modules`
- `dist`
- `.git`
- `logs`
- IDE files
- Documentation

#### Backend .dockerignore
Excludes backend development files:
- `__tests__`
- `coverage`
- `*.test.js`
- Development dependencies
- Documentation

### 🚀 Usage Instructions

#### Development Environment
```bash
# Start all services
docker-compose up -d

# Start with performance testing
docker-compose --profile testing up -d

# View logs
docker-compose logs -f frontend
docker-compose logs -f backend
```

#### Production Build
```bash
# Build and deploy frontend
docker-compose build frontend
docker-compose up -d frontend

# Build and deploy backend
docker-compose build backend
docker-compose up -d backend

# Full stack deployment
docker-compose build
docker-compose up -d
```

#### Development with Hot Reload
```bash
# Backend development with volume mounts
docker-compose up -d backend postgres redis

# Frontend development (use npm run dev)
npm run dev
```

### 🔍 Service URLs

#### Local Development
- Frontend: http://localhost:3000
- Backend API: http://localhost:4001
- Grafana Dashboard: http://localhost:3001
- InfluxDB: http://localhost:8086

#### API Endpoints
- Health Check: http://localhost:4001/health
- Suppliers API: http://localhost:4001/suppliers
- Scorecards API: http://localhost:4001/supplier-scorecards

### 🧪 Health Checks

#### Frontend Health Check
```bash
curl http://localhost:3000/health
# Returns: "healthy\n"
```

#### Backend Health Check
```bash
curl http://localhost:4001/health
# Returns: JSON with service status
```

#### Docker Health Status
```bash
docker-compose ps
# Shows health status of all containers
```

### 📈 Monitoring and Observability

#### Grafana Dashboards
- Application performance metrics
- Database connection monitoring
- Redis cache performance
- System resource utilization

#### InfluxDB Metrics
- k6 performance test results
- Custom application metrics
- System performance data

### 🔄 Database Initialization

The PostgreSQL container automatically initializes with:
- `suppliers_schema.sql` - Supplier management tables
- `payments_schema.sql` - Payment processing tables
- `risk_assessments_schema.sql` - Risk assessment tables
- `delivery_schedules_schema.sql` - Delivery schedule tables

### 🛠️ Troubleshooting

#### Common Issues
1. **Port conflicts**: Ensure ports 3000, 3001, 4001, 5432, 6379, 8086 are available
2. **Permission issues**: Check .dockerignore files and volume permissions
3. **Network issues**: Verify pharma-network is created properly
4. **Database connection**: Check DATABASE_URL environment variable

#### Debug Commands
```bash
# Check container logs
docker-compose logs [service-name]

# Execute commands in container
docker-compose exec backend sh
docker-compose exec postgres psql -U postgres -d supplier_db

# Rebuild specific service
docker-compose build --no-cache [service-name]

# Clean up volumes and networks
docker-compose down -v
```

### ✅ Validation Checklist

- [x] Frontend Dockerfile created with multi-stage build
- [x] Backend Dockerfile updated with security improvements
- [x] Docker Compose paths updated and verified
- [x] Network configuration implemented
- [x] Volume mounts properly configured
- [x] Health checks added to all services
- [x] .dockerignore files optimized
- [x] Environment variables configured
- [x] Port mappings updated to avoid conflicts
- [x] Documentation completed

### 🎉 Summary

The Docker configuration update is **complete and fully functional**. Key achievements:

1. **✅ Path Updates**: All build contexts and volume paths corrected
2. **✅ Security**: Non-root users, minimal images, proper isolation
3. **✅ Performance**: Multi-stage builds, caching, optimization
4. **✅ Monitoring**: Health checks, metrics, observability
5. **✅ Documentation**: Comprehensive usage and troubleshooting guides

**Ready for development and production deployment!** 🚀
