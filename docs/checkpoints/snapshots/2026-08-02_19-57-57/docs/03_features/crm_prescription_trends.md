# CRM Prescription Trend Intelligence

Prescription Trend Intelligence converts standard visit histories into strategic revenue indicators.

---

## 1. Telemetry Data Gathering

Monthly prescription records are compiled from:
- **MR Audits**: Field feedback recorded in chemist logs.
- **Secondary Orders**: Mapped chemist order bookings.
- **Distributor Stock Velocities**: Primary distributor stock outtakes.

---

## 2. Product-to-Specialty Target Matrix

System automatically enforces detailing suggestions based on target mapping:

| Target Specialty | Promoted Brand Category |
|------------------|-------------------------|
| Cardiologist     | Cardio-Vascular SKU A   |
| Diabetologist    | Anti-Diabetic SKU B     |
| Pediatrician     | Pediatric Suspension C  |

*If an MR details an Anti-Diabetic SKU to a Pediatrician, the call quality checks automatically penalize the DCR quality index.*

---

## 3. Predictive Switch & Churn Detection

The AI engine tracks month-over-month sales trends and flags anomalies:
- **Anomaly Detection**: Displays warning alerts if competitor brand distribution rises by `> 20%` while our brand sales drop.
- **Risk Indicator**: Flags "Missed Visit Risk" if the MR has deviated from the potential-based visit frequency rules for longer than 15 days.

---

## 4. Doctor 360 Dashboard Panel
Visual cards mapped to manager dashboards displaying:
- Current Potential Tier (e.g., A+)
- AI Engagement Index %
- 3-Month Trend Line (Sales Growth)
- Sample ROI Ratio (Investment vs returns)
- Competitor Pressure Index (High/Medium/Low)
