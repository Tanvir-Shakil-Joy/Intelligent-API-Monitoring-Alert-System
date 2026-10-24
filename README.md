# Intelligent API Monitoring & Alert System

An automated API health monitoring and intelligent anomaly detection system for a healthcare company integrating with external patient and clinical services. The system evaluates response metrics, detects multi-dimensional performance and availability anomalies, generates concise human-readable alerts using LLMs with deterministic zero-key fallbacks, persists anomalies in MongoDB, and displays active incidents on a real-time React dashboard.

---

## 1. Project Overview & Architecture

### 1.1 Problem Scenario
Healthcare integrations with external EHR, appointment, and lab systems frequently encounter transient degradation—such as high response times, partial outages (HTTP 5xx/4xx), or empty datasets (missing/zero records). This system provides proactive anomaly detection and operator-focused AI explanations without alert fatigue.

### 1.2 System Architecture

```mermaid
flowchart TD
    subgraph Inputs["Ingestion Channels"]
        A1["POST /monitor (HTTP REST)"]
        A2["npm run monitor:file (CLI Static JSON)"]
    end

    subgraph Backend["Express 4 Backend (Node.js 20)"]
        B1["Joi Validation & Partitioning"]
        B2["Pure Anomaly Engine (Rules & Thresholds)"]
        B3["Batch Orchestrator (p-limit Concurrency Pool)"]
        B4["AI Service (Gemini / OpenAI Adapter)"]
        B5["Deterministic Fallback Engine"]
        B6["MongoDB Alert Service (Mongoose)"]
        B7["Nodemailer Email Digest (Optional)"]
    end

    subgraph Storage["Storage & External"]
        DB[("MongoDB 7 Database")]
        LLM["Google Gemini / OpenAI API"]
        SMTP["SMTP Mail Server"]
    end

    subgraph Frontend["React 18 + Vite Dashboard"]
        FE1["Summary Metric Cards"]
        FE2["Active Alert Feed & Filters"]
        FE3["Interactive 'Run Monitor' Panel"]
    end

    A1 & A2 --> B1 --> B2 --> B3
    B3 --> B4 -->|API Key Set| LLM
    B4 -->|Missing Key / Error| B5
    B3 --> B6 --> DB
    B3 -.->|EMAIL_ENABLED| B7 -.-> SMTP
    FE1 & FE2 & FE3 <-->|GET /alerts & POST /monitor| Backend
```

---

## 2. Prerequisites

- **Node.js**: `v20.x` or higher (LTS recommended)
- **MongoDB**: `v7.x` or higher running locally or via MongoDB Atlas
- **Package Manager**: `npm` (v10+)
- **Optional**: Docker & Docker Compose (for containerized deployments)

---

## 3. Quick Start & Setup

### 3.1 Clone & Repository Structure
```bash
git clone <repository-url>
cd "Intelligent API Monitoring & Alert System"
```

### 3.2 Backend Installation & Configuration
```bash
cd backend
npm install

# Copy environment template
cp .env.example .env
```

Edit `backend/.env` with your preferred settings:
```env
PORT=5001
MONGO_URI=mongodb://localhost:27017/api_monitor
LLM_PROVIDER=gemini
LLM_API_KEY=your_gemini_api_key_here  # Leave blank to test deterministic fallback
```

Start the backend:
```bash
# Production mode
npm start

# Development mode with hot-reload
npm run dev
```
*Backend runs at `http://localhost:5001` (or port `5000` if available; automatically falls back if 5000 is occupied by macOS AirPlay).*
*Database: Connects to MongoDB when available; automatically activates embedded persistent storage if MongoDB is not running locally.*

### 3.3 Frontend Installation & Launch
```bash
cd ../frontend
npm install
npm run dev
```
*Frontend runs at `http://localhost:3000` and automatically proxies API requests to the backend.*

---

## 4. Environment Variables Reference

| Variable | Type | Default | Description |
|---|---|---|---|
| `PORT` | Number | `5001` | Port for Express backend (auto-falls back to 5001 if 5000 is occupied). |
| `NODE_ENV` | String | `development` | Runtime environment (`development`, `production`, `test`). |
| `MONGO_URI` | String | `mongodb://localhost:27017/api_monitor` | MongoDB connection string. |
| `SLOW_THRESHOLD_MS` | Number | `3000` | Latency exceeding this triggers a `medium` severity alert. |
| `VERY_SLOW_THRESHOLD_MS` | Number | `5000` | Latency exceeding this triggers a `high` severity alert. |
| `LLM_PROVIDER` | String | `gemini` | AI provider adapter (`gemini` or `openai`). |
| `LLM_API_KEY` | String | `""` | Provider API key. When blank, system seamlessly uses deterministic fallbacks. |
| `LLM_MODEL` | String | `gemini-1.5-flash` | LLM model identifier (`gemini-1.5-flash`, `gpt-4o-mini`). |
| `LLM_TIMEOUT_MS` | Number | `10000` | Max timeout for AI generation before triggering fallback (10s). |
| `LLM_CONCURRENCY` | Number | `5` | Maximum concurrent LLM requests via `p-limit`. |
| `EMAIL_ENABLED` | Boolean | `false` | Master toggle for email digest reports on critical/high alerts. |
| `SMTP_HOST` | String | `""` | SMTP mail server hostname. |
| `SMTP_PORT` | Number | `587` | SMTP port (e.g. 587 for TLS, 465 for SSL). |
| `SMTP_USER` | String | `""` | SMTP authentication user. |
| `SMTP_PASS` | String | `""` | SMTP authentication password (never logged). |
| `SMTP_FROM` | String | `alerts@api-monitor.local` | Sender email address. |
| `ALERT_RECIPIENT_EMAIL` | String | `""` | Recipient email address for operational alerts. |

---

## 5. Anomaly Detection Rules & Severity Hierarchy

The pure rules engine (`anomalyService.js`) independently evaluates each response metric against three criteria. A single response can trigger multiple anomalies simultaneously.

| Anomaly Type | Condition | Severity | Description |
|---|---|---|---|
| `SERVER_ERROR` | HTTP status `500` to `599` | `critical` | Upstream service failure or unhandled exception. |
| `HIGH_RESPONSE_TIME` | `response_time_ms > 5000` | `high` | Severe latency violation requiring immediate investigation. |
| `ZERO_RECORDS` | `records_returned` is `0`, `null`, or omitted | `high` | Missing or zero records returned from an active endpoint. |
| `CLIENT_ERROR` | HTTP status `400` to `499` | `medium` | Bad request, authentication rejection, or route not found. |
| `HIGH_RESPONSE_TIME` | `response_time_ms > 3000` and `≤ 5000` | `medium` | Warning latency degradation. |

### Severity Resolution: Highest-Severity-Wins
When multiple anomalies occur simultaneously, the top-level severity resolves to the highest priority:
$$\text{critical} > \text{high} > \text{medium}$$
*Example:* `AppointmentAPI` with HTTP 500 (`critical`), 5500 ms latency (`high`), and 0 records (`high`) resolves to **`critical`**, while preserving all three triggered tags in `anomalyTypes`.

---

## 6. Ingestion Methods

### Method 1: HTTP REST API (`POST /monitor`)
Ingest batches of monitored API telemetry via HTTP:

```bash
curl -X POST http://localhost:5001/monitor \
  -H "Content-Type: application/json" \
  -d '[
    {
      "api_name": "PatientDataAPI",
      "response_time_ms": 1200,
      "status_code": 200,
      "records_returned": 50
    },
    {
      "api_name": "AppointmentAPI",
      "response_time_ms": 5500,
      "status_code": 500,
      "records_returned": 0
    }
  ]'
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "summary": {
    "processed": 2,
    "healthy": 1,
    "anomaliesDetected": 1,
    "alertsCreated": 1,
    "invalidItems": 0,
    "failures": 0,
    "durationMs": 740
  },
  "alerts": [
    {
      "id": "6650f1c2a4b3c2d1e0f9a8b7",
      "apiName": "AppointmentAPI",
      "severity": "critical",
      "anomalyTypes": ["HIGH_RESPONSE_TIME", "SERVER_ERROR", "ZERO_RECORDS"],
      "message": "AppointmentAPI failed with status 500 and returned 0 records. Possible outage or data issue.",
      "messageSource": "ai"
    }
  ]
}
```

### Method 2: CLI Static JSON File Runner (`npm run monitor:file`)
Pass static JSON datasets through the exact same ingestion and AI pipeline used by `POST /monitor`:

```bash
cd backend
npm run monitor:file
```
*To run against a custom file:*
```bash
npm run monitor:file -- /path/to/custom-data.json
```

---

## 7. Active Alerts API (`GET /alerts`)

Retrieve active operational anomalies sorted by `createdAt: -1`:

```bash
# Fetch all active alerts
curl http://localhost:5001/alerts

# Filter by severity
curl "http://localhost:5001/alerts?severity=critical"

# Filter by API name
curl "http://localhost:5001/alerts?apiName=AppointmentAPI"
```

---

## 8. Optional Email Notifications Setup

To receive email digests when new `critical` or `high` severity anomalies occur:

1. Configure SMTP parameters in `.env`:
   ```env
   EMAIL_ENABLED=true
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   ALERT_RECIPIENT_EMAIL=oncall-team@healthcare.org
   ```
2. Any batch containing high-severity anomalies will dispatch an HTML digest table.
3. Email delivery errors are logged to Winston and **never** block or fail the HTTP response.

---

## 9. Verification & Testing

### 9.1 Running Automated Unit Tests
```bash
cd backend
npm test
```
The test suite validates:
- `anomalyService.test.js`: Pure rules engine, threshold boundaries, and severity hierarchy.
- `fallbackMessages.test.js`: Grammatical correctness of fallback messages across all anomaly combinations.

### 9.2 Verification Checklist & Edge Cases
| Scenario | Command | Expected Result |
|---|---|---|
| **Empty Array** | `curl -X POST http://localhost:5001/monitor -H "Content-Type: application/json" -d '[]'` | `400 Bad Request` (`VALIDATION_ERROR`) |
| **Non-Array Body** | `curl -X POST http://localhost:5001/monitor -H "Content-Type: application/json" -d '{}'` | `400 Bad Request` (`VALIDATION_ERROR`) |
| **Malformed Item Partitioning** | Submit 1 valid item + 1 invalid item (`api_name: ""`) | `200 OK`, valid item saved, `invalidItems: 1` |
| **Zero-Key Fallback** | Unset `LLM_API_KEY` in `.env` and submit batch | `200 OK`, `messageSource: "fallback"`, <50ms latency |

---

## 10. Frontend Dashboard Features

- **Header**: Live backend health status, auto-refresh countdown (every 15s), manual refresh.
- **Summary Cards**: Click-to-filter stat cards for Total, Critical, High, and Medium anomalies.
- **Filter Controls**: Severity filter pills and real-time API name search.
- **Alert Cards**: Displays color-coded badges, relative timestamps, raw telemetry pills, and AI (`✨ AI Alert`) vs. Fallback badges.
- **Run Monitor Panel**: Built-in test sandbox to submit JSON arrays directly to `POST /monitor` in the browser with live syntax validation.
