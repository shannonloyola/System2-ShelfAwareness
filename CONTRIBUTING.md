# Contributing to Pharma Distribution Management System

Thank you for your interest in contributing to our project! This guide will help you get started.

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Git
- Code editor (VS Code recommended)

### Development Setup

1. **Fork the repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/your-username/pharmadistributionmanagementsystem.git
   cd pharmadistributionmanagementsystem
   ```

2. **Set up upstream remote**
   ```bash
   git remote add upstream https://github.com/original-owner/pharmadistributionmanagementsystem.git
   ```

3. **Install dependencies**
   ```bash
   npm install
   cd services/supplier-service
   npm install
   cd ../..
   ```

4. **Start development environment**
   ```bash
   # Option 1: Local development
   npm run dev:all

   # Option 2: Docker development
   docker-compose -f docker-compose.dev.yml up -d
   ```

## 🌿 Branch Strategy

We follow a simplified Git flow:

- `main`: Production-ready code
- `develop`: Integration branch for features
- `feature/*`: Feature branches
- `hotfix/*`: Critical fixes

### Creating a Feature Branch

```bash
# Sync with main
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/your-feature-name

# Push to your fork
git push origin feature/your-feature-name
```

## 📝 Development Guidelines

### Code Style

- Use ESLint for code formatting
- Follow TypeScript best practices
- Use meaningful variable and function names
- Write clear, concise comments

### Testing Requirements

All contributions must include appropriate tests:

```bash
# Run all tests before committing
npm run test:ci

# Run specific test suites
npm run test:frontend
npm run test:backend
npm run test:contract
```

### Commit Messages

Follow conventional commit format:

```
type(scope): description

feat(api): add supplier rating endpoint
fix(frontend): resolve navigation issue
docs(readme): update installation instructions
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style
- `refactor`: Code refactoring
- `test`: Test additions
- `chore`: Maintenance

## 🧪 Testing Guide

### Running Tests

```bash
# All tests
npm run test

# Frontend tests
npm run test:frontend

# Backend tests
npm run test:backend

# Contract tests
npm run test:contract

# Integration tests
npm run test:integration
```

### Writing Tests

#### Frontend Tests
```javascript
// Example component test
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

test('renders component correctly', () => {
  render(<MyComponent />);
  expect(screen.getByText('Expected Text')).toBeInTheDocument();
});
```

#### Backend Tests
```javascript
// Example API test
import request from 'supertest';
import { app } from '../src/index.js';

test('GET /health returns 200', async () => {
  const response = await request(app)
    .get('/health')
    .expect(200);
  
  expect(response.body.status).toBe('healthy');
});
```

#### Contract Tests
```javascript
// Example consumer contract test
import { PactV3, MatchersV3 } from '@pact-foundation/pact';

const provider = new PactV3({
  consumer: 'PharmaPOFrontend',
  provider: 'SupplierService',
});

test('supplier data contract', () => {
  provider
    .given('supplier exists')
    .uponReceiving('request for supplier')
    .withRequest({
      method: 'GET',
      path: '/suppliers/123',
    })
    .willRespondWith({
      status: 200,
      body: {
        data: like({
          id: '123',
          name: 'Test Supplier',
        }),
      },
    });
});
```

## 🐳 Docker Development

### Building Images

```bash
# Build all services
docker-compose build

# Build specific service
docker-compose build frontend
docker-compose build backend
```

### Development Workflow

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop environment
docker-compose -f docker-compose.dev.yml down
```

### Debugging Containers

```bash
# Execute commands in container
docker-compose exec backend sh
docker-compose exec frontend sh

# Access database
docker-compose exec postgres psql -U postgres -d supplier_db
```

## 🔄 Pull Request Process

### Before Submitting

1. **Update documentation** if needed
2. **Run all tests** and ensure they pass
3. **Update CHANGELOG.md** for significant changes
4. **Rebase** with main if needed

```bash
# Sync with main
git fetch upstream
git rebase upstream/main

# Run tests
npm run test:ci

# Push changes
git push origin feature/your-feature-name
```

### Creating Pull Request

1. Go to your fork on GitHub
2. Click "New Pull Request"
3. Select your feature branch
4. Fill out the PR template
5. Request reviews from maintainers

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] All tests pass
- [ ] New tests added
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
```

## 🐛 Bug Reports

### Reporting Issues

1. **Search existing issues** first
2. **Use descriptive title**
3. **Provide detailed information**:
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details
   - Screenshots if applicable

### Bug Report Template

```markdown
## Bug Description
Clear description of the issue

## Steps to Reproduce
1. Go to...
2. Click on...
3. See error

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- OS: [e.g. Windows 10, macOS 12.0]
- Browser: [e.g. Chrome 100, Firefox 99]
- Node.js version: [e.g. 20.0.0]
- Docker version: [e.g. 20.10.0]

## Additional Context
Any other relevant information
```

## 💡 Feature Requests

### Proposing Features

1. **Check roadmap** for existing plans
2. **Create issue** with `feature-request` label
3. **Provide detailed description**:
   - Problem statement
   - Proposed solution
   - Use cases
   - Implementation ideas

## 📚 Documentation

### Updating Documentation

- **README.md**: Project overview and setup
- **API docs**: Endpoint documentation
- **Code comments**: Complex logic explanations
- **CHANGELOG.md**: Version history

### Documentation Style

- Use clear, concise language
- Include code examples
- Add screenshots where helpful
- Keep documentation up-to-date

## 🔍 Code Review

### Review Process

1. **Automated checks** must pass
2. **At least one maintainer** approval required
3. **Address all feedback** before merge
4. **Keep PRs focused** on single feature/fix

### Review Guidelines

- **Be constructive** and respectful
- **Focus on code quality**, not style preferences
- **Ask questions** if something is unclear
- **Suggest improvements** when possible

## 🚀 Release Process

### Version Management

We follow semantic versioning (SemVer):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Steps

1. **Update version numbers**
2. **Update CHANGELOG.md**
3. **Create release tag**
4. **Deploy to production**
5. **Update documentation**

## 🤝 Community Guidelines

### Code of Conduct

- **Be respectful** and inclusive
- **Welcome newcomers** and help them learn
- **Focus on what is best** for the community
- **Show empathy** towards other community members

### Getting Help

- **Check documentation** first
- **Search existing issues**
- **Ask questions** in discussions
- **Join community channels** if available

## 🏆 Recognition

Contributors are recognized in:
- **README.md** contributors section
- **Release notes** for significant contributions
- **Community highlights** for outstanding work

## 📞 Contact

- **Issues**: For bug reports and feature requests
- **Discussions**: For general questions and ideas
- **Security**: For security vulnerabilities (private report)

---

Thank you for contributing to the Pharma Distribution Management System! 🎉
