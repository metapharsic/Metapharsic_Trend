# UI/UX Screen Flow Blueprint

This blueprint outlines the visual pathways for both the field-force mobile application and the desktop web portal.

---

## 1. Mobile App Screen Flow (MR / ASM in Field)

### Flow 1: Authentication & Device Binding
```
[ Launch Screen ] 
       │
       ▼
[ Login Screen (Email/Pass) ] ──(If new device)──► [ Device Authorization Request ] ──► [ Admin Approval Screen ]
       │
       ▼
[ Face Identity Capture ] (Enforce biometric baseline validation)
       │
       ▼
[ Mobile Main Dashboard ]
```

### Flow 2: Daily Check-In & Call Reporting (DCR)
```
[ Main Dashboard ] ──► [ My Route/Map Plan ] 
                              │
                              ▼
                       [ Doctor Clinic List ]
                              │
                       (Within 100m Geofence)
                              ▼
                       [ Check-In Button ] 
                              │
                              ▼
                       [ Meeting details Form ]
                       - Products detailed (dropdown multi-select)
                       - Samples given (counter)
                       - Gifts given (counter)
                              │
                              ▼
                       [ Check-Out & Submit ] (Offline queue backup if offline)
```

### Flow 3: Chemist Stock Audit & Order Booking
```
[ Main Dashboard ] ──► [ Chemist List ]
                              │
                              ▼
                       [ Chemist Action Screen ]
                         ├──► [ Stock Audit Form ] (SKU available, Qty, Expiry batch)
                         └──► [ Order Booking Form ] (Select SKU, Qty, Auto price check)
                                     │
                                     ▼
                              [ Route to Mapped Distributor ]
```

### Flow 4: Visual Aids Presentation
```
[ Detailings Menu ] ──► [ Select Product ] ──► [ Launch Presenter UI ]
                                                   │
                                            (Slide Carousel)
                                                   │
                                                   ▼
                                        [ Auto Engagement Log ] (Upload slide durations)
```

---

## 2. Web Portal Screen Flow (Admin / ASM / RM / Executives)

```
[ Web Login ] ──► [ Role Router ]
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
  [ Admin Panel ]  [ Manager Dashboard ] [ Executive Dashboard ]
   - Device binding  - TP Approvals        - Regional Heatmaps
   - User creation   - Expense Audits      - Sales Forecast Graph
   - Audit logs      - KPI trackers        - ROI Charts
```

- **Institutional Tender Panel**: Under Manager Dashboard -> Select Hospital -> Input Tender contract rates and valid dates.
- **HR Portal**: Review Leave Requests, generate Payroll payslips, and monitor LMS course certifications.
