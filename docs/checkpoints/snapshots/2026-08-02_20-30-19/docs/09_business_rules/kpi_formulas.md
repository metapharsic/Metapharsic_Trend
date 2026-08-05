# KPI Formulas & Analytics Library

This document contains the mathematical equations used to calculate performance, compliance, and coverage metrics across Pharma OS.

---

## 1. Call Quality Score (CQS)

$$\text{CQS} = w_{\text{dur}} \cdot \text{DurationScore} + w_{\text{det}} \cdot \text{DetailingScore} + w_{\text{roi}} \cdot \text{SampleRoiScore}$$

- **DurationScore**: `100` if Visit Duration is between 3 to 10 minutes; decays linearly down to `0` if < 2 minutes or > 30 minutes.
- **DetailingScore**: Percentage of promoted products that match the Doctor's specialty category.
- **SampleRoiScore**: Evaluates if the quantity of samples distributed aligns with the doctor's potential tier (e.g. tier "A" doctors should receive higher quantities of high-value samples).

---

## 2. Coverage Score (CS)

$$\text{CS} = \left( \frac{\text{Unique Doctors Visited in Month}}{\text{Total Assigned Doctors in Territory}} \right) \times 100$$

- **Goal**: Measure the percentage of assigned doctors visited at least once during a monthly cycle.

---

## 3. Tour Plan Adherence (TPA)

$$\text{TPA} = \left( \frac{\text{Planned Visits Completed}}{\text{Total Planned Visits in approved TP}} \right) \times 100$$

- **Constraint**: A visit is only classified as "Planned Visit Completed" if the visit occurred on the planned day, at the planned clinic location, and within the geofenced boundary.

---

## 4. Discipline Score (DS)

$$\text{DS} = w_{\text{att}} \cdot \text{AttendanceCheckIns} + w_{\text{dcr}} \cdot \text{OnTimeDCR} - \text{Penalty}_{\text{fraud}}$$

- **AttendanceCheckIns**: Percentage of days with check-ins completed before 9:30 AM.
- **OnTimeDCR**: Percentage of DCR logs submitted within 24 hours of completion.
- **Penalty_fraud**: Deduct `100` points immediately if any Mock GPS logs or coordinate spoofing attempts are recorded.

---

## 5. Doctor Engagement Index (DEI)

$$\text{DEI} = 0.3 \cdot \text{VisitFrequency} + 0.3 \cdot \text{ConversionRatio} + 0.4 \cdot \text{PrescriptionPotential}$$

---

## 6. Doctor Potential Score (DPS)

$$\text{DPS} = 0.3 \cdot \text{PatientFootfallDaily} + 0.25 \cdot \text{PrescriptionFrequency} + 0.2 \cdot \text{InfluencerLevel} + 0.15 \cdot \text{TerritoryPriority} + 0.1 \cdot \text{EngagementScore}$$

- **PatientFootfallDaily**: Daily patient capacity of the doctor's clinic.
- **PrescriptionFrequency**: Target average daily prescriptions written.
- **InfluencerLevel**: 1-5 rating representing regional market weight.
- **TerritoryPriority**: Priority of target zone (1 = Normal, 2 = High).
- **EngagementScore**: Current Call Quality running average (CQS).

---

## 7. Visit Frequency Rules

The system maps the dynamically computed DPS to fixed monthly visit counts:

| Doctor Potential Tier | DPS Range | Required Monthly Visits |
|-----------------------|-----------|-------------------------|
| **A+** (Very High)    | 85 - 100  | 12 visits/month         |
| **A** (High)          | 65 - 84   | 8 visits/month          |
| **B** (Medium)        | 35 - 64   | 4 visits/month          |
| **C** (Low)           | 0 - 34    | 1–2 visits/month        |

