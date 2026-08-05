# Microservices Architecture

Pharma OS is designed as a distributed, service-oriented system composed of lightweight microservices communicating via secure, high-performance channels.

---

## 1. Core Services & Frameworks

### API Gateway
- **Technology**: NestJS Gateway / Kong API Gateway.
- **Responsibilities**: Authentication, Rate Limiting, CORS, CORS validation, Dynamic routing to microservices.

### SFA (Sales Force Automation) Service
- **Technology**: NestJS.
- **Responsibilities**: Tour planning, DCR logging, geo-fenced check-ins, offline queue sync.

### CRM Service
- **Technology**: NestJS.
- **Responsibilities**: Doctor profiling, history aggregation, indexing, and priority flags.

### HRMS & Attendance Service
- **Technology**: NestJS (integrates AWS Rekognition / Face API).
- **Responsibilities**: Attendance validation, LMS logging, incentive rules parser.

### Expense Service
- **Technology**: NestJS + Python OCR processor.
- **Responsibilities**: OCR bill scan verification, fraud validation, ASM/RM approval workflow.

### AI Engine (Service)
- **Technology**: Python (FastAPI) + PyTorch / Scikit-learn.
- **Responsibilities**: Route Optimization, Forecasts, NLP parser for Chatbot queries.

---

## 2. Communication Protocols

- **Synchronous Internal Communication**:
  - **gRPC**: High-speed binary RPC protocols are used for high-frequency internal transactions (e.g., SFA querying HRMS for attendance logs during DCR check-ins).
- **Asynchronous Event-Driven Messaging**:
  - **RabbitMQ**: Message broker managing queues for asynchronous operations (e.g., when a DCR is submitted, SFA publishes an event to RabbitMQ; CRM and AI forecasting consume it to recalculate indices).

---

## 3. Distributed Database Patterns

```
                 [ API Gateway ]
                        │
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
   [ SFA Service ]  [ CRM Service ]  [ AI Service ]
         │              │              │
     [Postgres]      [Postgres]     [FastAPI]
         │              │              │
         └──────────────┼──────────────┘
                        ▼
                 [ Event Broker ] (RabbitMQ)
                        │
                        ▼
                 [ ElasticSearch ] (Read BI Replica)
```

- **PostgreSQL**: Partitioned database per microservice to maintain service independence (Database-per-service pattern).
- **Redis Cache**: Used for session caching, rate-limit keys, and active user location caching.
- **Elasticsearch**: Consolidated read replica. RabbitMQ publishes mutations to sync a global Elasticsearch engine to drive real-time BI drill-down dashboards without locking transactional tables.
