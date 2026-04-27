
  # Pharma Distribution Management System

  This is a code bundle for Pharma Distribution Management System. The original project is available at https://www.figma.com/design/Fl4hGmw2RESQoKXa4y76Pt/Pharma-Distribution-Management-System.

  ## Running the code

  The active frontend lives in `src/frontend` and is served through the
  top-level scripts.

  1. Run `npm i` to install the root dependencies.
  2. Run `npm run install:frontend` to install the frontend dependencies.
  3. Run `npm run install:backend` to install the Nest backend dependencies.
  4. Run `npm run install:supplier` to install the supplier service dependencies.
  5. Run `npm run dev` to start the frontend on `http://localhost:5173`.
  6. Run `npm run dev:backend` to start the Nest backend on `http://localhost:3001`.
  7. Run `npm run dev:supplier` to start the supplier service on `http://localhost:4001`.

  ## Supplier API service

  Run `npm run dev:supplier` to start the supplier microservice.

  Health check: `http://localhost:4001/health`

  ## Backend API service

  Run `npm run dev:backend` to start the Nest backend API.

  Health check: `http://localhost:3001/api/health`
  
