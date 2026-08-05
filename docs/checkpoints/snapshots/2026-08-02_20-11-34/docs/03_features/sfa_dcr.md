# Daily Call Report (DCR) Specifications

DCR is a productivity, compliance, and promotion tracker, acting as the primary transaction interface for Medical Representatives in the field.

---

## 1. DCR Field Workflows

### Step 1: Selfie & Check-in Check
- **Process**: MR performs a camera check-in (selfie + face recognition) on launch.
- **Data Logged**: GPS latitude/longitude, GPS accuracy (meters), and unique hardware Device ID.

### Step 2: Customer Selection
- Displays planned Doctors/Chemists from the Monthly Tour Plan (TP) for the current date.
- Allows "Unplanned Visit" selection from nearby Doctor/Chemist entities within GPS range.

### Step 3: Visit Check-in
- Tapping **"Start Visit"** validates the current GPS coordinates against the doctor's registered location coordinates.
- Logs network strength and distance deviation from geofence.

### Step 4: Product Promotion & Materials
- **Call Type Selection**: Regular, Follow-up, New Product, Reminder, Institutional, or Joint Work.
- **Promotions detailed**: Selects detailed products, specifies if a physical visual aid or digital tablet detailing was utilized, and captures details of competitor activity.
- **Samples & Gifts Balance**: Auto-adjusts remaining local inventory balance when items are allocated to the doctor.

### Step 5: Close Visit & Checkout
- Tracks total call duration (Exit Timestamp - Entry Timestamp).
- Captures optional photo/signature check out verification.

---

## 2. Intelligence & Compliance Audit

- **Call Quality scoring**: Computed dynamically (1-100) based on products detailed, time duration, and sample match against the Doctor's specialty category.
- **Compliance Rules**:
  - Automatically flags visits with durations `< 2 minutes` as suspicious.
  - Detects duplicate visit coordinates submitted sequentially within short intervals.
- **DCR Locking**: Locked 24 hours after completion. Re-edits require supervisor approval.
