# Development & Licensing Cost Estimation

This document provides a realistic cost projection for the development and licensing of Pharma OS.

---

## 1. Professional Services & Team Sizing

Project development is modeled across a 6-month MVP delivery window with the following resources:

| Role | Count | Monthly Rate (Est.) | Total Cost (6 Months) |
|------|-------|---------------------|-----------------------|
| Project Manager / Product Owner | 1 | $7,000 | $42,000 |
| Lead Architect / Backend Engineer | 1 | $9,000 | $54,000 |
| Backend Developer (NestJS) | 2 | $6,000 | $72,000 |
| Mobile Developer (Flutter) | 2 | $6,000 | $72,000 |
| UI/UX Designer | 1 | $5,000 | $15,000 (3 Mos.) |
| QA Engineer | 1 | $4,500 | $27,000 |
| **Total Personnel Cost** | **8** | - | **$282,000** |

---

## 2. Infrastructure & Tooling Licenses

Estimated monthly running costs for staging and production tiers:

| Component / Tool | Technology / Provider | Staging (Monthly) | Production (Monthly) |
|------------------|-----------------------|-------------------|----------------------|
| Database Clusters | AWS RDS PostgreSQL | $150 | $800 (Multi-AZ) |
| API / Service Hosts | AWS ECS (Fargate) | $200 | $1,200 (Autoscaling) |
| Caching | AWS ElastiCache Redis | $50 | $250 |
| Search & Analytics | Elastic Cloud | $100 | $400 |
| Face Match Biometrics | AWS Rekognition | $50 | $300 (Pay-per-use) |
| OCR Receipt Scans | AWS Textract | $30 | $150 (Pay-per-use) |
| Message Queuing | CloudAMQP (RabbitMQ) | $0 (Free tier) | $150 |
| Domain, CDN & SSL | Cloudflare Enterprise | $20 | $200 |
| **Total Monthly Infra** | - | **$600** | **$3,450** |

---

## 3. Total Project Cost Summary (Year 1)
- **Initial Development (6 Months)**: $282,000
- **Infrastructure Staging (6 Months)**: $3,600
- **Infrastructure Production (6 Months)**: $20,700
- **Buffer & Operational Contingency (15%)**: $45,945
- **Grand Total Estimate**: **$352,245**
