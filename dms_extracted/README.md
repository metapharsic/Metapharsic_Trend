# Document Management System (DMS) - Standalone Module Package

This standalone package contains the complete **Document Management System (DMS)** module extracted from the ERP system, including frontend React components, backend Express routes, database schemas, full sample seed data, and documentation.

---

## 📁 Package Structure

```
dms_extracted/
├── README.md                           # This overview and deployment guide
├── backend/
│   ├── routes/
│   │   └── dms.js                      # Express REST API routes for DMS
│   └── migrations/
│       └── 20260416_dms_restoration.sql# PostgreSQL DDL Migration script
├── frontend/
│   ├── components/
│   │   └── Documents.tsx               # Main React frontend UI component
│   └── types/
│       └── dms.ts                      # TypeScript interfaces & types
├── data/
│   ├── dms_schema_and_seed.sql         # Combined SQL Schema & Seed dataset
│   └── dms_sample_data.json            # JSON format of sample document records & workflows
├── docs/
│   ├── overview.md                     # Architecture overview & REST endpoints
│   ├── workflows.md                    # Workflow transitions & event model
│   └── rules.md                        # Business logic & compliance rules
└── uploads/
    └── dms/                            # Upload storage directory & sample files
```

---

## 🚀 Key Features

1. **Document Repository & Search**: Filter documents by category (SOP, License, Policy, Compliance, Report), search by ID/Title, and view current document status.
2. **Version Control**: Manage multi-version documents with audit history and change logs.
3. **Workflow & Approvals**: Multi-step document approval chains (Drafting → Review → Approval → Published).
4. **Compliance Audit Log**: Detailed trail tracking creation, edits, approvals, downloads, and access IP.
5. **Real Storage Tracking**: Dynamic size calculation (`SUM(file_size)`) rather than mock placeholders.
6. **Excel Reports Export**: Dynamic Excel export for Document Register, Version History, Workflows, Audit Log, and Compliance.

---

## 🛠 Integration & Setup

### 1. Database Setup (PostgreSQL)
Run the bundled SQL script to create tables and insert sample records:
```bash
psql -U postgres -d your_database_name -f data/dms_schema_and_seed.sql
```

### 2. Backend Integration (Express.js)
Copy `backend/routes/dms.js` into your Express project and register the route:
```javascript
const dmsRouter = require('./routes/dms');
app.use('/api/dms', dmsRouter);
```
Make sure your project configures file upload storage to point to `uploads/dms`.

### 3. Frontend Integration (React + TypeScript)
1. Import `frontend/types/dms.ts` into your types directory.
2. Import `frontend/components/Documents.tsx` in your view router/dashboard.
3. Ensure required dependencies are installed:
```bash
npm install lucide-react xlsx
```

---

## 🔒 Business Rules & Soft Deletion
- **Soft Delete Only**: Deleted documents maintain `status = 'Deleted'` and retain audit logs.
- **Audit Logging**: Every document creation, edit, or approval writes an immutable entry to `dms_audit_trail`.
- **Multer Storage**: Maximum single file upload size limit is 50MB.

---
*Extracted and packaged automatically on 2026-09-08T00:47:46.398Z*
