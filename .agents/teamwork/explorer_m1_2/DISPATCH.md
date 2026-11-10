# Dispatch: Explorer M1.2 (Backend API Routes & Validators)

## Identity
- Role: M1 API & Validators Explorer
- Type: teamwork_explorer
- Working directory: c:\Trend_MR\.agents\teamwork\explorer_m1_2\
- Original Request path: c:\Trend_MR\.agents\teamwork\ORIGINAL_REQUEST.md
- Scope document: c:\Trend_MR\PROJECT.md

## Mission & Scope
Investigate exact API route and validator changes needed for M1 (R1):
- `web/lib/validators.ts`: Update `CreateEntityBodySchema` and `UpdateEntityBodySchema` to accept `doctorIds: z.array(z.string().uuid()).optional()`.
- `web/app/api/manager/entities/route.ts`: Handle `POST` with `doctorIds`, inserting into `ChemistDoctor` transactionally.
- `web/app/api/manager/entities/[id]/route.ts`: Handle `PUT` updating `ChemistDoctor` associations, and `GET` returning `assignedDoctors` with Doctor fields (`id`, `fullName`, `primarySpecialty`, `clinicAddress`).
- Check any existing entity tests in `web/__tests__/entities-crud-wiring.test.ts`.
- Write handoff.md with concrete code modifications and verification commands.


## 2026-11-01T08:01:42Z
[Message] timestamp=2026-11-01T08:01:42Z sender=e37c775e-5ecb-4d12-998c-97d63e271e40 priority=MESSAGE_PRIORITY_HIGH content=You are the M1 API & Validators Explorer (explorer_m1_2).
Working directory: c:\Trend_MR\.agents\teamwork\explorer_m1_2\

MANDATORY FIRST STEP:
Read the verbatim user requirements in c:\Trend_MR\.agents\teamwork\ORIGINAL_REQUEST.md.
Also read:
- c:\Trend_MR\PROJECT.md
- c:\Trend_MR\.agents\teamwork\explorer_m1_2\DISPATCH.md
- c:\Trend_MR\web\lib\validators.ts
- c:\Trend_MR\web\app\api\manager\entities\route.ts
- c:\Trend_MR\web\app\api\manager\entities\[id]\route.ts
- c:\Trend_MR\web\__tests__/entities-crud-wiring.test.ts

Mission & Scope:
Investigate exact API route and validator changes needed for M1 (R1 Chemist Master Profiles Doctor Assignment):
1. `web/lib/validators.ts`: Update `CreateEntityBodySchema` and `UpdateEntityBodySchema` to accept `doctorIds: z.array(z.string().uuid()).optional()`.
2. `web/app/api/manager/entities/route.ts`: Handle `POST` with `doctorIds`, inserting into `ChemistDoctor` transactionally.
3. `web/app/api/manager/entities/[id]/route.ts`: Handle `PUT` updating `ChemistDoctor` associations, and `GET` returning `assignedDoctors` with Doctor demographic fields (`id`, `fullName`, `primarySpecialty`, `clinicAddress`).
4. Consider if a dedicated helper endpoint `web/app/api/chemists/[id]/doctors/route.ts` is beneficial.
5. Provide precise line numbers, code snippets, and verification commands.

Scope Boundary:
You are a READ-ONLY explorer. DO NOT edit source code files.

Output:
Write your structured findings to `c:\Trend_MR\.agents\teamwork\explorer_m1_2\handoff.md` (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
When done, send a message to parent orchestrator.
