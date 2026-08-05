# ADR 002: Offline Synchronization Strategy

## Status
Accepted

## Context
Medical Representatives (MRs) operate in clinics, hospitals, and remote areas with poor or intermittent internet coverage. They must log DCRs, order bookings, and view route maps offline. When connectivity is restored, all data must sync back to the backend without data corruption.

## Decision
- **Mobile Offline Database**: Use **RxDB** (Reactive Database) for Flutter, which runs locally on the device with full encryption.
- **Sync Protocol**: Custom HTTP/JSON queue syncing mechanism.
- **Conflict Resolution (LWW - Last Write Wins)**:
  - Every mobile transaction logs a high-precision UTC timestamp (`deviceTimestamp`).
  - In conflicts, the backend compares timestamps and resolves changes using Last Write Wins.
- **Queue Pipeline**:
  - Offline mutations are pushed into a local SQLite/RxDB queue.
  - A background service detects network state shifts. When active, it uploads items in FIFO order.

## Consequences
- Requires strict client-side timestamp synchronization (using NTP fallback if the device clock is modified).
- Sync conflict resolution is simplified but handles 95% of typical SFA sales transactions.
