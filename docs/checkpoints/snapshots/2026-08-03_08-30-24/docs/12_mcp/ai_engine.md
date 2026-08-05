# AI Engine (2026-Ready Layer)

This document contains the functional architecture of the AI service.

---

## AI Capability Modules

### 1. AI Route Optimization
- **Goal**: Minimize travel time and cost while maximizing doctor coverage.
- **Inputs**: Planned doctor coordinates, current traffic data, historical waiting times per clinic.
- **Output**: Suggested ordered sequence of visits for the MR's day.

### 2. AI Doctor Prioritization
- **Goal**: Daily recommendation of top 15 doctors to visit.
- **Logic**: Integrates the Doctor Intelligence Index to suggest high-ROI targets over low-value routine calls.

### 3. AI Sales Forecasting
- **Goal**: Forecast stock demands per territory.
- **Logic**: Time-series forecasting (Seasonal ARIMA or Prophet models) adjusted by local epidemic trends (seasonal illnesses) and historical ordering velocity.

### 4. AI Fraud Detection
- **Goal**: Detect suspicious activity without manual audit.
- **Logic**:
  - **Fake GPS Detection**: Flags mock location provider signatures on the Flutter application.
  - **Visit Clustering**: Identifies impossibly short travel times between two geographically distant clinics.
  - **DCR Timing**: Flags reports submitted with timestamps that do not correlate with GPS logs.

### 5. In-App AI Assistant (PharmaChat)
- **Goal**: Allow MRs and Managers to query the database using natural language.
- **Examples**:
  - *"Which doctors in Region B have I not visited in the last 20 days?"*
  - *"Who are the top 5 chemists with outstanding payments exceeding 30 days?"*

---

## 6. Executive AI Insights & Dashboard

The AI dashboard serves as the central decision brain for leadership (MD, NSMs):
- **Sales Forecasting**: Generates a 3-month predictive sales forecast using seasonal demand models.
- **Product Decline Alerts**: Identifies when a key product's prescribing volume begins dropping within a specific specialty segment (e.g. Cardiologists).
- **Churn Risk Indicators**: Calculates the probability of a doctor shifting loyalty to competitor brands.

---

## 7. AI Alerts System

Autonomous triggers broadcast alerts:
- *"Region South is projected to miss target by 8% due to lower Cardiologist visit volumes."*
- *"Cardio X brand volume is declining. Competitor Brand Y is showing 15% growth in territory Z."*
- *"Employee John Doe's check-ins show suspicious coordinates replication logs."*

---

## 8. Predictive Simulation Models

- **Inventory Planning**: Simulates warehouse inventory run-rates to prevent stock-outs at stockist levels.
- **Scheme Impact Simulator**: Simulates estimated order growth volume and margins before launching new product discount schemes.

