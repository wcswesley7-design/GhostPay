# GhostPay Production Checklist

This project runs in sandbox mode. To operate a real bank in Brazil, you must use a regulated BaaS/PSP and complete compliance.

## Regulatory and Compliance
- Obtain required licenses or partner with a licensed institution.
- Implement KYC/AML workflows and sanctions screening.
- Maintain LGPD policies: data minimization, retention, and auditability.
- PCI DSS scope if you store or process card data.

## Banking Integrations
- Select a BaaS/PSP with Pix and card issuing rails.
- Replace sandbox Pix and card flows with provider API calls.
- Configure webhook verification and event replay.

## AWS Baseline
- Use VPC + private subnets for the API and database.
- PostgreSQL on RDS with encryption at rest and backups.
- Secrets stored in AWS Secrets Manager.
- Centralized logging (CloudWatch) and audit trails.

## Security
- Enforce MFA for admin access.
- Rotate JWT secrets and webhook secrets.
- Enable WAF and rate limiting at the edge.

## Observability
- Metrics (latency, error rates, transaction throughput).
- Structured logs for all money movements.

