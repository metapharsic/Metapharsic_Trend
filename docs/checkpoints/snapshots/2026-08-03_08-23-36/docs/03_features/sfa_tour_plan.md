# Tour Plan (TP) Specifications

Tour Plan controls territory coverage, visit discipline, and strategic distribution.

---

## 1. Monthly Planning Grid

MRs plan their schedules in advance for the upcoming month:
- **Town Selection**: Assigns specific target towns/regions per day.
- **Customer List**: Links planned Doctors and Chemists to each day's route.
- **Status tracking**: Tracks leave days, national/territory holidays, and ASM joint-work days.

---

## 2. Approval Routing
- **MR Draft**: Saved locally or uploaded in `DRAFT` status.
- **Submission**: Updates status to `PENDING_ASM`.
- **ASM Action**: The ASM can review, suggest modifications, reject, or mark as `APPROVED`.
- **Locking**: Once marked `APPROVED`, the plan is locked from further MR edits.

---

## 3. Dynamic AI Suggestions
During TP drafting, the AI suggestion engine highlights:
- High-potential "A+" doctors who have not been visited in the last 25 days.
- Low-coverage territory segments.
- Optimized route loops to group clinics in proximity.

---

## 4. Planned vs Actual Adherence

The system compares DCR logs against the approved Tour Plan to calculate metrics:
- **TP Adherence Rate**: `%` of visits completed exactly as planned.
- **Deviation Alerts**: Highlight unapproved town changes or unplanned doctor calls.
- **Dashboard Displays**: ASM dashboards highlight coverage gaps and missed clinic targets.
