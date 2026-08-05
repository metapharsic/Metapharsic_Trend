# Core Business Rules & Query Validation logic

This document contains the exact database queries and backend validation logic required to enforce core business rules using the Prisma database schema.

---

## 1. DCR (Daily Call Reporting) Validation

- **Rule**: An MR cannot submit a DCR (Visit log) for a day unless their attendance for that specific day is marked as `PRESENT`.
- **Query Validation (TypeScript/Prisma)**:
```typescript
async function validateDcrSubmission(employeeId: string, visitDate: Date): Promise<boolean> {
  const visitDay = new Date(visitDate.setHours(0,0,0,0));
  
  const attendance = await prisma.attendance.findUnique({
    where: {
      employeeId_date: {
        employeeId,
        date: visitDay
      }
    }
  });

  if (!attendance || attendance.status !== 'PRESENT') {
    throw new Error("DCR Blocked: Attendance must be checked in and marked PRESENT for this day.");
  }
  return true;
}
```

---

## 2. Tour Planning (TP) Submission Window

- **Rule**: TP for the upcoming month must be submitted by the 25th of the current month. Once a TP is `APPROVED`, it cannot be modified by the MR.
- **Query Validation**:
```typescript
async function validateTourPlanEdit(tourPlanId: string): Promise<boolean> {
  const plan = await prisma.tourPlan.findUnique({
    where: { id: tourPlanId }
  });

  if (!plan) throw new Error("Tour Plan not found.");
  
  // Rule 1: No edits on Approved Plans
  if (plan.status === 'APPROVED') {
    throw new Error("Blocked: Approved Tour Plans cannot be modified.");
  }

  // Rule 2: Validation of submission timeline (25th of preceding month)
  const today = new Date();
  const planMonth = new Date(plan.month);
  
  const isPrecedingMonth = (planMonth.getMonth() === (today.getMonth() + 1) % 12);
  if (isPrecedingMonth && today.getDate() > 25) {
    throw new Error("Blocked: Monthly Tour Plans must be submitted before the 25th.");
  }
  
  return true;
}
```

---

## 3. Manager Hierarchy Expense Routing

- **Rule**: Standard claims (< $500) route to the ASM (immediate manager). High-value claims (>= $500) route to the RM (next-level manager).
- **Query Routing Logic**:
```typescript
async function getExpenseApprover(employeeId: string, amount: number): Promise<string> {
  // Fetch MR's direct manager (ASM)
  const mr = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { managerId: true }
  });

  if (!mr.managerId) throw new Error("Hierarchy Error: No manager assigned to employee.");

  if (amount < 500) {
    return mr.managerId; // Routes to ASM
  } else {
    // Fetch RM (ASM's manager)
    const asm = await prisma.employee.findUnique({
      where: { id: mr.managerId },
      select: { managerId: true }
    });
    
    if (!asm.managerId) {
      return mr.managerId; // Fallback to ASM if no RM exists
    }
    return asm.managerId; // Routes to RM
  }
}
```

---

## 4. Fraud Prevention & Mock Location Lockout

- **Rule**: Any location log capturing a spoofed coordinates provider signature flags `isMocked: true` and triggers a user lockout.
- **Lockout Logic**:
```typescript
async function logCoordinates(employeeId: string, lat: float, lng: float, isMocked: boolean) {
  await prisma.locationLog.create({
    data: { employeeId, latitude: lat, longitude: lng, isMocked }
  });

  if (isMocked) {
    // Fetch user account and lock it out
    const emp = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { userId: true }
    });

    await prisma.user.update({
      where: { id: emp.userId },
      data: { isActive: false } // Auto-lockout account
    });
    
    throw new Error("Security Alert: Mock location provider detected. Account suspended.");
  }
}

---

## 5. Expense Policy Limit Check

- **Rule**: Claims exceeding the predefined limit for a user's role and category must be flagged as out-of-policy.
- **Query Validation**:
```typescript
async function verifyExpensePolicy(employeeId: string, category: string, claimAmount: number): Promise<boolean> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { user: true }
  });

  const policy = await prisma.expenseLimit.findUnique({
    where: {
      role_category: {
        role: employee.user.role,
        category
      }
    }
  });

  if (policy && claimAmount > Number(policy.limitAmount)) {
    return false; // Out-of-policy claim
  }
  return true; // Within limit
}
```

---

## 6. Duplicate Receipt Audit

- **Rule**: Duplicate receipt uploads (matched via file hashing in the OCR engine) must be auto-flagged and rejected.
- **Query Validation**:
```typescript
async function detectDuplicateReceipt(receiptHash: string): Promise<boolean> {
  const duplicate = await prisma.expense.findFirst({
    where: {
      receiptHash,
      status: { not: 'REJECTED' } // Only check active/approved bills
    }
  });

  return !!duplicate; // Returns true if a duplicate exists
}
```

---

## 7. Claim Processing & Credit Note Issuance

- **Rule**: When a secondary product claim (damaged/expired stock) is finalized by the Distributor, it marks the Claim as `COMPLETED` and creates a corresponding `CreditNote` in a single transaction.
- **Transaction Validation**:
```typescript
async function finalizeClaim(claimId: string, creditNumber: string, creditAmount: number) {
  return await prisma.$transaction(async (tx) => {
    // 1. Update the claim status
    const claim = await tx.claim.update({
      where: { id: claimId },
      data: { status: 'COMPLETED' }
    });

    // 2. Generate the distributor credit note
    const creditNote = await tx.creditNote.create({
      data: {
        claimId: claim.id,
        number: creditNumber,
        amount: creditAmount
      }
    });

    return { claim, creditNote };
  });
}
```

---

## 8. Visit Frequency Audit

- **Rule**: Checks if doctor visits fall short of the required frequency mapped in the potential matrix and flags a "Missed Visit Alert".
- **Query Validation**:
```typescript
async function auditVisitFrequency(doctorId: string) {
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    include: { crmProfile: true }
  });

  if (!doctor || !doctor.crmProfile) return;

  // 1. Determine expected visits based on score
  const score = doctor.intelligenceScore;
  let requiredVisits = 1;
  if (score >= 85) requiredVisits = 12;
  else if (score >= 65) requiredVisits = 8;
  else if (score >= 35) requiredVisits = 4;

  // 2. Fetch visits count for the current calendar month
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const visitsCount = await prisma.visit.count({
    where: {
      doctorId,
      createdAt: { gte: startOfMonth }
    }
  });

  return {
    required: requiredVisits,
    actual: visitsCount,
    isCompliant: visitsCount >= requiredVisits
  };
}
```

---

## 9. Competitor Brand Switch Detection

- **Rule**: Analyzes competitor activity reports against our sales volumes. If competitor discussions increase while our sales drops, flag a high-risk switch warning.
- **Switch Detection Query**:
```typescript
async function detectCompetitorSwitchRisk(doctorId: string, productId: string): Promise<boolean> {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  // 1. Gather competitor brand feedback intensity
  const competitorMentions = await prisma.competitorLog.count({
    where: {
      visit: { doctorId },
      activityIntensity: 'HIGH',
      createdAt: { gte: threeMonthsAgo }
    }
  });

  // 2. Check month-over-month sales growth
  const salesHistory = await prisma.prescriptionHistory.findMany({
    where: {
      doctorId,
      productId,
      month: { gte: threeMonthsAgo }
    },
    orderBy: { month: 'desc' }
  });

  if (salesHistory.length >= 2) {
    const latestMonth = salesHistory[0].unitsPrescribed;
    const previousMonth = salesHistory[1].unitsPrescribed;
    
    // Switch conditions: competitor mentions exist AND our brand volumes are declining
    if (competitorMentions > 3 && latestMonth < previousMonth) {
      return true; // High switch risk flagged
    }
  }
  return false;
}
```


```
