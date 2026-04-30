# SCM Workspace

The SCM application is split into frontend and backend workspaces so CI/CD can run only the pipeline affected by a change.

## Structure

- `scm/scm-frontend/` contains the active React/Vite frontend.
- `scm/scm-backend/backend/` contains the core backend API.
- `scm/scm-backend/services/` contains backend microservices such as supplier, procurement, inventory, warehouse receiving, notification, reporting, document, and auth services.

## CI/CD

- `.github/workflows/scm-frontend.yml` runs when files under `scm/scm-frontend/**` change.
- `.github/workflows/scm-backend.yml` runs when files under `scm/scm-backend/**` change.

## Docker

The root `docker-compose.yml` now builds images from the new `scm/` paths:

- Frontend build context: `./scm/scm-frontend`
- Backend API build context: `./scm/scm-backend/backend`
- Backend microservice contexts: `./scm/scm-backend/services/<service-name>`
