# Dispatch: Milestone 1 Sub-orchestrator

## Identity
- Role: Milestone 1 Sub-orchestrator (Chemist Master Profiles Doctor Assignment)
- Working directory: c:\Trend_MR\.agents\teamwork\sub_orch_m1\
- Parent: Project Orchestrator (Conversation ID: f6ef167a-1c90-46cc-bd90-6f5c22824b66)
- Original Request path: c:\Trend_MR\.agents\teamwork\ORIGINAL_REQUEST.md
- Scope document: c:\Trend_MR\PROJECT.md

## Scope & Objective
Deliver Milestone 1 (M1): Chemist Master Profiles Doctor Assignment (R1).
- DB schema `ChemistDoctor` M:N junction in `web/prisma/schema.prisma` with `@@unique([chemistId, doctorId])`, `onDelete: Cascade`, indexes.
- In `web/lib/validators.ts`: Update entity schemas (`CreateEntityBodySchema`, `UpdateEntityBodySchema`) to accept `doctorIds: z.array(z.string().uuid()).optional()`.
- In `web/app/api/manager/entities/route.ts` & `[id]/route.ts`:
  - `POST`: persist assigned doctor linkages.
  - `PUT`: sync/update assigned doctor linkages.
  - `GET`: return `assignedDoctors` with Doctor demographic details (`id`, `fullName`, `primarySpecialty`, `clinicAddress`).
- In `web/app/(dashboard)/entities/page.tsx`:
  - Update `ViewDossierModal` to display assigned doctors in Chemist dossier.
  - Update `AppendEntityModal` & `EditEntityModal` to provide multi-doctor searchable selector.
  - Chemist table: display assigned doctor counter badge.
- Follow the Iteration Loop (Explorer -> Worker -> Reviewers -> Challengers -> Auditor -> Gate).
- Report gate verdict and handoff when complete.
