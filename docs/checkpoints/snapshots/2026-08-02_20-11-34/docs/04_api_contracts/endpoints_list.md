# API Endpoints List

This file tracks all available API endpoints to ensure consistency between the frontend and backend.

## Response Format Standard
```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error?: {
    code: string;
    message: string;
  };
}
```

## Endpoints

### 1. Authentication & Identity
- `POST /api/auth/login`
  - Input: `{ email, password }`
  - Output: `{ accessToken, refreshToken, user: UserProfile }`

### 2. SFA & Field Operations
- `POST /api/sfa/dcr/submit`
  - Input: `{ employeeId, doctorId, purpose, feedback, latitude, longitude, samples: [{productId, quantity}], competitorLogs: [{brandName, activityIntensity, notes}] }`
  - Output: `{ success: true, visitId: UUID }`
- `POST /api/sfa/tour-plan/submit`
  - Input: `{ employeeId, month, days: [{date, territoryId, plannedDoctorId}] }`
  - Output: `{ success: true, tourPlanId: UUID }`

### 3. CRM & Stock Audits
- `POST /api/crm/chemists/stock-audit`
  - Input: `{ chemistId, productId, availableQty, expiryBatchQty }`
  - Output: `{ success: true, alertTriggered: boolean }`
- `POST /api/crm/hospitals/tender/submit`
  - Input: `{ hospitalId, tenderNo, products: [{productId, rateContractPrice}], validityEnd }`
  - Output: `{ success: true }`

### 4. Supply & Orders
- `POST /api/orders/secondary`
  - Input: `{ chemistId, distributorId, items: [{productId, quantity, price}] }`
  - Output: `{ success: true, orderId: UUID }`

### 5. HRMS & Claims
- `POST /api/expenses/claims/upload`
  - Input: `{ employeeId, amount, category, description, receiptImageBase64 }`
  - Output: `{ success: true, expenseId: UUID, policyCompliant: boolean }`
- `POST /api/hrms/leaves/apply`
  - Input: `{ employeeId, startDate, endDate, type, reason }`
  - Output: `{ success: true, leaveRequestId: UUID }`
