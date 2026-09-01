# Geo Tracking & Fraud Detection

Geo-tracking acts as the productivity validator and compliance monitor for all field operations.

---

## 1. Live Telemetry Tracking

- **Capture Frequency**: Captures coordinates every X minutes (configurable, e.g., every 15 minutes) during work hours.
- **Metrics Collected**: Latitude, Longitude, Travel speed, Battery percentage, and Network type.
- **Visibility**: Real-time position tracking and route line displays visible on ASM, RM, and Admin maps.

---

## 2. Geofence Rules & Audits

- **Radius Limit**: Visits (DCRs) must occur within a geofence limit (e.g., 100 meters) of the doctor's registered clinic location.
- **Accuracy threshold**: GPS readings with an accuracy indicator of `> 50 meters` are flagged for review.

---

## 3. Travel Intelligence & Route Analysis

- **Route Playback**: Generates dynamic timeline routes on maps showing start locations, travel pathways, stops, and checkout locations.
- **Idle Time**: Identifies locations where the MR is stationary for `> X minutes`.
- **Expense Verification**: Automatically cross-references claimed travel distances with actual GPS coordinates logged to compute exact travel reimbursement totals.

---

## 4. AI-Driven Fraud Shield

- **GPS Spoofing**: Identifies active mockup location providers, mock frameworks, or location virtualization apps on Android/iOS and suspends the user immediately.
- **Unrealistic Speed Warnings**: Flags travel segments displaying speeds exceeding threshold speeds (e.g. city speeds > 120 km/h) as suspicious.
- **Coordinated Visits**: Flags cases where multiple MRs upload identical coordinate locations at identical times.
