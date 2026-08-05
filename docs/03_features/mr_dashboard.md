# Feature: Medical Representative Daily Dashboard

The MR's home screen — a single view of the day in the field. Route `/mr`,
backed by `GET /api/mr/dashboard`.

Implementation:
- API — [web/app/api/mr/dashboard/route.ts](../../web/app/api/mr/dashboard/route.ts)
- Field rules — [web/lib/field-tracking.ts](../../web/lib/field-tracking.ts)
- Notification rules — [web/lib/notifications.ts](../../web/lib/notifications.ts)
- UI — [web/app/(dashboard)/mr/page.tsx](<../../web/app/(dashboard)/mr/page.tsx>)
- Tests — `__tests__/mr-dashboard.test.ts`, `__tests__/api-workflows.test.ts`

---

## 1. Access Rules

| Caller | Sees |
|---|---|
| `MR` | Own dashboard only. Passing `?employeeId=` returns **403**. |
| `ASM`, `ADMIN` | Own by default; `?employeeId=<id>` drills into a specific rep. |

Managers need the drill-down because a manager opening `/mr` without it would see
their *own* field activity, which is empty and meaningless for them.

---

## 2. The Twelve Tiles

| # | Tile | Definition | Source |
|---|---|---|---|
| 1 | Today's Visits | Planned calls on today's **approved** tour plan | `TourPlanDay` where `TourPlan.status = APPROVED` |
| 2 | Pending Visits | Planned doctors not yet visited today | planned − visited today |
| 3 | Completed Visits | All visits logged today, split planned vs unplanned | `Visit` created today |
| 4 | Sales Today | Value of orders **booked by this rep** today | `OrderItem.price × quantity` where `Order.employeeId` matches |
| 5 | Collection | Payments banked today | `Collection.amount` |
| 6 | Samples Distributed | Sample units handed out today | `Sample.quantity` via today's visits |
| 7 | Doctor Coverage | Unique doctors visited this month ÷ doctors in territory | `Visit` distinct on `doctorId` |
| 8 | Chemist Coverage | Same, for chemists | `Visit` distinct on `chemistId` |
| 9 | Travel Distance | Haversine sum over today's GPS track | `LocationLog` |
| 10 | GPS Status | See §3 | `LocationLog` |
| 11 | Expenses | Claimed today, plus pending and rejected counts | `Expense` |
| 12 | Notifications | Derived alerts, see §4 | rules engine |

**Note on tile 4:** `Order.employeeId` was added for this feature. Before it, orders
recorded only chemist and distributor, so per-rep sales could not be attributed at all.

---

## 3. GPS Status Decision Table

Evaluated top-down; first match wins.

| Condition | Status | Critical | Rationale |
|---|---|---|---|
| No usable fix today | `NO_SIGNAL` | Yes | Field activity cannot be verified |
| Any fix flagged `isMocked` | `MOCKED` | Yes | Spoofing; also triggers the account-lock job |
| Last fix older than **30 min** | `STALE` | No | Tracking gap, not necessarily misconduct |
| Otherwise | `ACTIVE` | No | — |

**`MOCKED` deliberately outranks `STALE`.** A spoofed fix is a compliance event and
must not be hidden by the reading also happening to be old.

### Future-dated fixes

Fixes dated more than **5 minutes** ahead of server time are discarded as
untrustworthy, and mock detection still runs across *every* reported point before
that filter is applied.

This was a real defect found during verification: the age calculation clamped
negatives to zero, so a device with a skewed clock — or a spoofer post-dating a
fix — reported "0 min ago / ACTIVE" indefinitely. A position you cannot date
cannot prove presence.

### Travel distance

Sum of haversine legs between consecutive fixes in chronological order.
**Mocked fixes are excluded from the total**, because mileage drives expense
reimbursement — including a spoofed coordinate would inflate the claim.

---

## 4. Notification Rules

One row per rule. Ordered by severity in the response: `CRITICAL → ERROR → WARNING → INFO`.

| Code | Severity | Fires when | Action shown |
|---|---|---|---|
| `GPS_MOCKED` | CRITICAL | Any spoofed fix today | Disable spoofing app, contact manager |
| `TOUR_PLAN_REJECTED` | ERROR | Current month's TP is `REJECTED` | Revise and resubmit |
| `EXPENSE_REJECTED` | ERROR | ≥1 claim in `REJECTED` | Review audit notes, resubmit |
| `NOT_CHECKED_IN` | WARNING | No attendance record **and** past 09:30 | Check in |
| `GPS_NO_SIGNAL` | WARNING | Checked in but no fix today | Enable location services |
| `PENDING_VISITS_LATE` | WARNING | Planned calls outstanding **and** past 17:00 | Complete or they count as missed |
| `TOUR_PLAN_DUE` | WARNING | Next month's TP not submitted **and** day ≥ 25 | Submit before month end |
| `COVERAGE_BEHIND_PACE` | WARNING | Coverage below elapsed-month pace by >15 points | Prioritise unvisited high-DPS doctors |
| `GPS_STALE` | INFO | Checked in, last fix >30 min old | Open the app to refresh |
| `LOW_SAMPLE_STOCK` | INFO | Any sample stock ≤10 units | Raise a replenishment request |

Thresholds are exported as `RULE_THRESHOLDS` so they live in one place.

### Design decisions worth knowing

**GPS alerts are suppressed until the rep has checked in.** Nagging someone about a
missing signal before their day starts trains them to ignore the feed.

**Coverage is paced against the month elapsed, not a flat target.** A rep on the 3rd
is not behind for having covered 10%; the rule compares against `days elapsed ÷ days
in month` with a 15-point tolerance.

**Time-of-day rules use server local time** (`Date.getHours()`), unlike date-range
queries which use UTC. "Past 09:30" means the rep's working day, not a UTC instant.

---

## 5. Workflow

```
Check in  ──▶  GPS track begins  ──▶  Visit planned doctors (TP-gated, geofenced)
                                              │
                                              ├──▶ Distribute samples  ──▶ CQS scored
                                              ├──▶ Book chemist order  ──▶ Sales Today
                                              └──▶ Record collection   ──▶ Collection
                                              │
Submit expense claim (receipt hashed)  ───────┤
                                              ▼
                                    Dashboard recomputes
                                    Notification rules re-evaluate
```

Every tile is derived at read time — there is no denormalised daily summary table
to fall out of sync.

---

## 6. Known Limits

- **Chemist and hospital calls are not tour-plan gated.** Only doctor visits are
  checked against the approved TP, so "Pending Visits" covers planned doctors only.
- **Travel distance is straight-line, not road distance.** Haversine legs between
  fixes under-report actual driving. Fine for anomaly detection; if it ever backs
  mileage *reimbursement*, it needs a routing provider.
- **Sampling depends on fix frequency.** With sparse `LocationLog` entries the track
  is coarse and the distance is understated. There is no minimum sampling rate enforced.
- **No push delivery.** Notifications are computed on request; nothing is pushed to
  the device or persisted, so there is no read/dismissed state.
