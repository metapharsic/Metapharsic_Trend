# MR Daily Field Lifecycle Workflow

This workflow documents the daily 10-step sequence executed by a Medical Representative using the mobile application.

---

## The 10-Step Lifecycle

### Step 1: Attendance Check-in
- MR launches the mobile application.
- Authenticates using biometric face verification.
- GPS coordinates are locked, verifying they are in their assigned territory to check in.

### Step 2: Route Review
- MR reviews the day's planned itinerary fetched from their approved Tour Plan (TP).

### Step 3: AI Priority Recommendations
- AI Engine displays the top recommended "Priority Visits" (based on doctor engagement indices and missing coverage).

### Step 4: Route Optimization
- Application plots the optimized routing sequence on a map loop, minimizing overall travel time and distance.

### Step 5: Clinic Arrival & Geofence Verification
- MR arrives at the first clinic and taps **"Start Visit"**. Geofencing checks coordinates against target clinic coordinates.

### Step 6: Detailings & Promotions
- MR details products (tracking if visual aids were utilized) and enters objections/competitor notes.

### Step 7: Sample Allocation
- App records distributed samples and subtracts quantities from local MR stock balances.

### Step 8: Visit Closure & Digital Verification
- MR completes details, collects signature/confirmation, and checks out.

### Step 9: Automatic Data Synchronization
- Visits sync to the backend. If offline, the payload remains in the local encrypted queue, retrying once network returns.

### Step 10: Performance Review
- At the end of the day, the MR views their Daily Performance Summary showing: calls completed, travel distance, and daily Call Quality score.
