# Gap Analysis

Tracks differences between current MVP boundaries and Enterprise requirements.

---

## Current Gaps & Action Items

### 1. Offline Sync Conflict Resolution
- **Issue**: Multi-device order bookings or TP updates while offline.
- **Status**: Rule-based override (latest timestamp wins).
- **Target Solution**: Introduce CRDTs (Conflict-free Replicated Data Types) in database sync handlers for secondary orders.

### 2. ERP Database Sync Syncing Latencies
- **Issue**: Synced data (Invoices/Stock) from SAP/Oracle can lag by up to 24 hours.
- **Target Solution**: Convert static batch ETL routines into RabbitMQ event streaming queues.

### 3. FaceMatch Face Biometrics Timeout Gaps
- **Issue**: In low network field areas, face recognition APIs (AWS Rekognition) trigger timeouts.
- **Target Solution**: Fallback to encrypted offline local face feature hashes checked inside the Flutter container.

### 4. Expense Bill Duplicate Check Thresholds
- **Issue**: Slightly modified receipt images (e.g. contrast edits) can bypass MD5 hash comparisons.
- **Target Solution**: Deploy visual hash comparisons (pHash) in the Python OCR microservice.
