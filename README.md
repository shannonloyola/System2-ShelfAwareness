# Pharma Distribution Management System

A comprehensive pharmaceutical distribution management system built with modern web technologies, featuring microservices architecture, contract testing, and CI/CD automation.

## Architecture Overview

This system implements a modern microservices architecture with the following components:

- **Frontend**: React-based web application with Material-UI
- **Backend**: Node.js microservices with Express.js
- **Database**: PostgreSQL with Supabase integration
- **Contract Testing**: Pact-based consumer-driven contract testing
- **CI/CD**: GitHub Actions with separate frontend/backend workflows
- **Containerization**: Docker with multi-stage builds and docker-compose
- **Monitoring**: Grafana dashboards with InfluxDB metrics

## Quick Start

### Prerequisites

- Node.js 20+ 
- Docker & Docker Compose
- Git

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd pharmadistributionmanagementsystem

# Install dependencies
npm install

# Install backend service dependencies
cd services/supplier-service
npm install
cd ../..
```

### Development Setup

#### Option 1: Local Development

```bash
# Start frontend (in root directory)
npm run dev

# Start backend service (in separate terminal)
npm run dev:supplier

# Or start both simultaneously
npm run dev:all
```

#### Option 2: Docker Development

```bash
# Start all services with Docker Compose
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f
```

### Access Points

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4001
- **API Health Check**: http://localhost:4001/health
- **Grafana Dashboard**: http://localhost:3001
- **InfluxDB**: http://localhost:8086

## Project Structure

```
pharmadistributionmanagementsystem/
├── .github/workflows/           # CI/CD workflows
│   ├── frontend-ci.yml         # Frontend CI/CD pipeline
│   ├── backend-ci.yml          # Backend CI/CD pipeline
│   └── k6-nightly.yml          # Performance testing
├── docs/                       # Documentation
├── scripts/                    # Utility scripts
├── services/                   # Microservices
│   └── supplier-service/       # Supplier management service
│       ├── src/               # Source code
│       ├── __tests__/         # Tests
│       └── Dockerfile         # Docker configuration
├── src/                        # Frontend source code
├── tests/                      # Test suites
│   ├── contract/              # Contract tests
│   ├── integration/           # Integration tests
│   └── performance/           # Performance tests
├── docker-compose.yml          # Production Docker setup
├── docker-compose.dev.yml      # Development Docker setup
├── Dockerfile.frontend         # Frontend Dockerfile
└── package.json               # Root package configuration
```

## Development

### Frontend Development

```bash
# Start development server
npm run dev

# Run tests
npm run test

# Build for production
npm run build

# Run linting
npm run lint

# Type checking
npm run type-check
```

### Backend Development

```bash
# Navigate to service directory
cd services/supplier-service

# Start development server
npm run dev

# Run tests
npm run test

# Run contract tests
npm run test:pact

# Database migrations
npm run migrate
```

### Docker Development

```bash
# Build all services
docker-compose build

# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# Start production environment
docker-compose up -d

# Stop services
docker-compose down

# Clean up volumes
docker-compose down -v
```

## Testing

### Test Types

1. **Unit Tests**: Jest-based unit testing
2. **Integration Tests**: End-to-end integration testing
3. **Contract Tests**: Pact consumer-driven contract testing
4. **Performance Tests**: K6 load testing

### Running Tests

```bash
# Run all tests
npm run test

# Frontend tests only
npm run test:frontend

# Backend tests only
npm run test:backend

# Contract tests
npm run test:contract

# Integration tests
npm run test:integration

# Performance tests
npm run loadtest:gateway
```

### Contract Testing

This project uses Pact for consumer-driven contract testing:

```bash
# Run consumer contract tests
npm run test:contract

# Run provider contract tests
npm run test:provider

# Publish contracts to Pact Broker
npm run pact:publish

# Verify contracts
npm run pact:verify

# Check deployment safety
npm run pact:can-i-deploy
```

## Deployment

### Environment Setup

1. **Development**: Local development with hot reload
2. **Staging**: Pre-production environment for testing
3. **Production**: Production deployment with monitoring

### Docker Deployment

```bash
# Deploy to staging
docker-compose -f docker-compose.yml up -d

# Deploy with performance testing
docker-compose --profile testing up -d

# Scale services
docker-compose up -d --scale backend=3
```

### CI/CD Deployment

The project uses GitHub Actions for automated deployment:

- **Frontend Workflow**: `.github/workflows/frontend-ci.yml`
- **Backend Workflow**: `.github/workflows/backend-ci.yml`

Deployment triggers:
- Push to `main` branch → Production deployment
- Push to `develop` branch → Staging deployment
- Pull requests → Build and test only

## Monitoring & Observability

### Health Checks

```bash
# Frontend health
curl http://localhost:3000/health

# Backend health
curl http://localhost:4001/health

# Docker health status
docker-compose ps
```

### Monitoring Stack

- **Grafana**: http://localhost:3001 (admin/admin)
- **InfluxDB**: http://localhost:8086
- **Performance Metrics**: K6 test results in Grafana

### Logs

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f frontend
docker-compose logs -f backend
```

## Security

### Security Features

- Non-root container execution
- Security headers in Nginx
- Environment variable management
- Dependency vulnerability scanning
- Container security best practices

### Security Scanning

```bash
# Run security audit
npm run security:audit

# Fix security issues
npm run security:fix

# Snyk security scan (requires API key)
snyk test
```

## API Documentation

### Supplier Service Endpoints

- `GET /health` - Health check
- `GET /suppliers` - List all suppliers
- `GET /suppliers/:id` - Get supplier by ID
- `GET /suppliers/lookup?name=:name` - Lookup supplier by name
- `POST /suppliers` - Create new supplier
- `PUT /suppliers/:id` - Update supplier
- `DELETE /suppliers/:id` - Delete supplier
- `GET /supplier-scorecards?supplier_name=:name` - Get supplier scorecard

### API Examples

```bash
# Health check
curl http://localhost:4001/health

# List suppliers
curl http://localhost:4001/suppliers

# Create supplier
curl -X POST http://localhost:4001/suppliers \
  -H "Content-Type: application/json" \
  -d '{"supplier_name":"Test Supplier","contact_person":"John Doe","email":"test@example.com"}'
```

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/supplier_db

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Pact Broker
PACT_BROKER_URL=https://your-pact-broker.com
PACT_BROKER_TOKEN=your_pact_broker_token

# Docker
NODE_ENV=development
PORT=4001
```

### Docker Configuration

The project uses multiple Docker configurations:

- `docker-compose.yml` - Production setup
- `docker-compose.dev.yml` - Development setup
- `Dockerfile.frontend` - Frontend multi-stage build
- `services/supplier-service/Dockerfile` - Backend service

## Contributing

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and ensure they pass
5. Submit a pull request

### Code Quality

- Use ESLint for code linting
- Follow TypeScript best practices
- Write tests for new features
- Update documentation as needed

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 3000, 3001, 4001, 5432, 6379, 8086 are available
2. **Database connection**: Check DATABASE_URL environment variable
3. **Docker issues**: Try `docker-compose down -v` then `docker-compose up -d`
4. **Node modules**: Delete `node_modules` and run `npm install`

### Debug Commands

```bash
# Check Docker container status
docker-compose ps

# View container logs
docker-compose logs [service-name]

# Execute commands in container
docker-compose exec backend sh
docker-compose exec postgres psql -U postgres -d supplier_db

# Rebuild containers
docker-compose build --no-cache
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Links

- **Original Design**: [Figma Design](https://www.figma.com/design/Fl4hGmw2RESQoKXa4y76Pt/Pharma-Distribution-Management-System)
- **API Documentation**: http://localhost:4001/docs (when running)
- **Monitoring Dashboard**: http://localhost:3001
- **Performance Reports**: Available in Grafana dashboard

---

**Built with ❤️ using modern web technologies and best practices**
