# MR Tracker — Pharma OS Core Engine

Pharma Enterprise Digital Platform (Complete Commercial Excellence Suite) for Sales, Distribution, HRMS, and Expense claims.

---

## Technical Stack
- **Web App**: Next.js, React, Tailwind CSS, TypeScript
- **Database**: PostgreSQL (Local Server)
- **Event Streaming**: Apache Kafka (Local Broker)
- **End-to-End Tests**: Selenium WebDriver
- **ORM**: Prisma

---

## Setup & Local Run

### Prerequisites
- Node.js >= 18
- PostgreSQL Server installed and running locally on port `5432`
- Apache Kafka broker installed and running locally on port `9092`
- Selenium Standalone server installed and running on port `4444`

### 1. Installation
```bash
git clone <repo-url>
cd MRtracker
npm install
```

### 2. Database Migration & Setup
1. Configure database link inside `web/.env`:
   ```env
   DATABASE_URL="postgresql://postgres:password@localhost:5432/mrtracker?schema=public"
   ```
2. Generate Prisma Client and deploy migrations:
   ```bash
   cd web
   npx prisma generate
   npx prisma migrate dev
   npx prisma db seed
   ```

### 3. Run Web App
```bash
npm run dev:web
# Launches on http://localhost:5555
```

### 4. Run Mobile App (Expo)
```bash
cd mobile
npx expo start
```
