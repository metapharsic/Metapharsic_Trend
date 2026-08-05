# ADR 001: Initial Architecture

## Status
Accepted

## Context
We need to build an Enterprise Pharma OS capable of scaling to 10,000+ users, with offline capabilities for MRs in the field, and a strong foundation for future AI integrations.

## Decision
- **Mobile**: Flutter, to support cross-platform (iOS/Android) with robust offline-first architecture.
- **Backend**: NestJS, to provide a structured, scalable, enterprise-grade Node.js backend.
- **Database**: PostgreSQL (relational integrity) + Prisma ORM (type safety).
- **Web**: Next.js, for the admin/manager dashboards.

## Consequences
- High initial setup complexity, but strong long-term maintainability.
- Ensures strict typing across the stack.
