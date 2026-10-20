# Security Policy

## Reporting a Vulnerability

Do not publish customer information, tokens, credentials or exploit details in a public issue.
Use the repository's GitHub **Report a vulnerability** option if available.
If private reporting is unavailable, open an issue requesting a private contact channel
without disclosing the vulnerability or personal data.

Only test environments/accounts you own or are explicitly authorized to assess.
Do not probe other restaurants or send attack traffic to the production service.

## Scope

Current development focuses on the latest repository state. There is no published
support window or guaranteed response SLA for older builds.
A local fix does not protect a deployed version until that version is upgraded.

## Deployment Checklist

- Keep PostgreSQL credentials, TLS settings, private network access and backups reviewed.
- Separate development, test and production databases; use least-privilege credentials.
- Configure exact CORS origins and independent random JWT/table secrets.
- Treat printed QR URLs as shareable links, not customer identity.
- Never expose full customer names, phone numbers or private order details on public boards.
- Configure Firebase credentials outside source control.
- Require verified release signing before distributing an Android production build.
- Review both runtime and build/test dependency advisories.
- Coordinate rate limits and login locks when running multiple API instances.
- Verify ownership checks against a real database before production release.

## Known Boundaries

Public rewards lookup is disabled pending customer verification.
The public order board deliberately reveals order references, table labels, initials
and statuses within one restaurant. Restaurant visitors can share the QR URL.
Existing rate limits and failed-login locks are process-local.
Customer CSP allows inline scripts/styles and is not a strict nonce policy.
Health checks do not verify database readiness.
The current verification record does not certify live database configuration, signed
Android release delivery or container behavior.

See [verification](docs/VERIFICATION.md) and [deployment](DEPLOYMENT.md).
