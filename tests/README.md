# Tests Directory

This directory contains all test files for the WebGIS project.

## Structure

```
tests/
├── api/              # API testing files
│   ├── test-api-direct.html      # Direct API calls test
│   └── test-api-proxy.html       # Proxied API calls test
│
├── data/             # Data loading and validation tests
│   └── test-clcd-data.html       # CLCD JSON data loading test
│
└── database/         # Database connection and query tests
    ├── test-db.js                # Database connection test
    └── test-2023.js              # 2023 data query test
```

## How to Use

### API Tests
- **test-api-direct.html**: Tests direct API calls (run from root directory)
- **test-api-proxy.html**: Tests API calls through Vite proxy

**Access**: Open in browser after starting dev server  
`http://localhost:5173/tests/api/test-api-direct.html`

### Data Tests
- **test-clcd-data.html**: Validates CLCD JSON data loading

**Access**:  
`http://localhost:5173/tests/data/test-clcd-data.html`

**Features**:
- Load land use configuration
- Test province data loading
- Test prefecture data loading  
- Test county data loading (5250 records)

### Database Tests
- **test-db.js**: Node.js script to test database connection
- **test-2023.js**: Script to query 2023 CLCD data

**Run**:
```bash
node tests/database/test-db.js
node tests/database/test-2023.js
```

## Requirements

- Frontend dev server running (`npm run dev`)
- Backend server running (`npm run server`) for API tests
- PostgreSQL database running for database tests
