# BRIEFING — 2026-11-01T07:38:15Z

## Mission
Enable assigning multiple doctors to chemists, billing doctor selection with assigned pre-filtering, doctor performance analytics in Profit & Earned Income, wired using concurrency/asynchronous multi-threaded processing.

## 🔒 My Identity
- Archetype: orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: c:\Trend_MR\.agents\teamwork\orchestrator\
- Original parent: parent
- Original parent conversation ID: 689ea226-b543-42f6-8ef1-c200893894b1

## 🔒 My Workflow
- **Pattern**: Project
- **Scope document**: c:\Trend_MR\PROJECT.md
1. **Decompose**: Survey (3 Explorers) -> Decompose into milestones & E2E Testing track -> Dispatch sub-orchestrators
2. **Dispatch & Execute** (pick ONE):
   - **Delegate (sub-orchestrator)**: Spawn a sub-orchestrator per milestone and for E2E testing track
3. **On failure** (in this order):
   - Retry: nudge stuck agent or re-send task
   - Replace: spawn fresh agent with partial progress
   - Skip: proceed without (only if non-critical)
   - Redistribute: split stuck agent's remaining work
   - Redesign: re-partition decomposition
   - Escalate: report to parent (sub-orchestrators only, last resort)
4. **Succession**: At 16 spawns, write handoff.md, spawn successor
- **Work items**:
  1. Survey and architecture mapping [in-progress]
  2. PROJECT.md & TEST_INFRA.md decomposition [pending]
  3. Milestone execution & Dual-track testing [pending]
  4. Final E2E and adversarial verification [pending]
- **Current phase**: 1
- **Current focus**: Survey phase (3 parallel Explorers dispatched)

## 🔒 Key Constraints
- NEVER write, modify, or create source code files directly.
- NEVER run build/test commands yourself — require workers to do so.
- NEVER investigate or explore the problem at the code level — dispatch Explorers for technical investigation.
- You MAY use file-editing tools ONLY for metadata/state files (.md) in your .agents/teamwork/ folder.
- Never reuse a subagent after it has delivered its handoff — always spawn fresh
- Audit Enforcement: If a Forensic Auditor reports INTEGRITY VIOLATION, milestone fails unconditionally.

## Current Parent
- Conversation ID: 689ea226-b543-42f6-8ef1-c200893894b1
- Updated: not yet

## Key Decisions Made
- Project Orchestration Pattern selected with dual track (Implementation + E2E Testing).
- Survey phase dispatched 3 parallel teamwork_explorer subagents.

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| explorer_survey_1 | teamwork_explorer | Architecture & Stack Explorer | in-progress | 0f43ab42-f218-4b10-9908-d014ae6a823d |
| explorer_survey_2 | teamwork_explorer | Profiles & Billing Explorer | in-progress | 875ca231-55f0-4974-9424-058bb45d105c |
| explorer_survey_3 | teamwork_explorer | Analytics & Test Explorer | in-progress | 1595622f-5f52-462b-9161-2fbf0c71e296 |

## Succession Status
- Succession required: no
- Spawn count: 3 / 16
- Pending subagents: 0f43ab42-f218-4b10-9908-d014ae6a823d, 875ca231-55f0-4974-9424-058bb45d105c, 1595622f-5f52-462b-9161-2fbf0c71e296
- Predecessor: none
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: f6ef167a-1c90-46cc-bd90-6f5c22824b66/task-22
- Safety timer: none
- On succession: kill all timers before spawning successor
- On context truncation: handle timers as step 4 of the State Recovery section of your prompt says

## Artifact Index
- c:\Trend_MR\.agents\teamwork\ORIGINAL_REQUEST.md — User requirements
- c:\Trend_MR\.agents\teamwork\orchestrator\DISPATCH.md — Initial dispatch message
- c:\Trend_MR\.agents\teamwork\orchestrator\BRIEFING.md — Persistent working memory
- c:\Trend_MR\.agents\teamwork\orchestrator\progress.md — Progress and liveness heartbeat
