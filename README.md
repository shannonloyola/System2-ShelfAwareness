
## Pharma Distribution Management System

This repository is split into:

- `src/frontend`: Next.js frontend
- `src/backend`: Nest.js backend

The original UI bundle came from the Figma design at `https://www.figma.com/design/Fl4hGmw2RESQoKXa4y76Pt/Pharma-Distribution-Management-System`.

## Install

```bash
npm run install:frontend
npm run install:backend
```

## Run

Frontend:

```bash
npm run dev:frontend
```

Backend:

```bash
npm run dev:backend
```

Frontend-to-backend wiring:

- Frontend calls the Nest API via `NEXT_PUBLIC_API_BASE_URL`
- Default backend URL is `http://localhost:3001/api`
  
