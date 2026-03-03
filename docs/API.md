# WebGIS Project API Documentation

## 1. AI Analysis & Chat

### 1.1 Stream Analysis
**POST** `/api/ai/analyze-stream`

Initiates a streaming analysis based on user input.

**Request Body:**
```json
{
  "messages": [
    { "role": "user", "content": "Analyze land use in Kunming in 2020" }
  ],
  "year": 2020,
  "componentContext": {
    "type": "prefecture_trend",
    "regionName": "Kunming"
  },
  "model": "gpt-oss:20b"
}
```

**Response:**
Server-Sent Events (SSE) stream.
- Event `data`: JSON object containing partial content or control signals.
  ```json
  { "content": "Based on the data..." }
  { "done": true }
  ```

### 1.2 Chat Sessions

- **GET** `/api/chat-sessions`: Get all chat sessions.
- **POST** `/api/chat-sessions`: Create a new session.
  - Body: `{ "title": "New Analysis" }`
- **DELETE** `/api/chat-sessions/:id`: Delete a session.
- **GET** `/api/chat-sessions/:id/messages`: Get messages for a session.

## 2. CLCD Data (Land Use)

### 2.1 Province Level
**GET** `/api/clcd/province`
Returns time-series land use data for the entire Yunnan province (1985-2023).

### 2.2 Prefecture Level
**GET** `/api/clcd/prefecture`
Returns data for all prefectures.

**GET** `/api/clcd/trend/prefecture/:name`
Returns time-series data for a specific prefecture.

### 2.3 County Level
**GET** `/api/clcd/county`
Returns data for all counties.

**GET** `/api/clcd/trend/county/:name`
Returns time-series data for a specific county.

## 3. Auth

**POST** `/api/auth/login`
- Body: `{ "username": "admin", "password": "..." }`
- Returns: `{ "token": "jwt_token", "user": { ... } }`

**POST** `/api/auth/register`
- Body: `{ "username": "newuser", "password": "..." }`

## 4. Analysis Tools

**POST** `/api/analysis/spatial-query`
Performs spatial queries (e.g., intersect, within).

**POST** `/api/analysis/stats`
Calculates statistics for a given region/year.

---
*Note: For detailed OpenAPI specification, see `docs/openapi.yaml`.*
