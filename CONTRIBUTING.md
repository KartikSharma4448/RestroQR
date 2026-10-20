# Contributing

Discuss substantial changes with the maintainer before implementation.
The repository's existing proprietary terms apply; a public GitHub repository
does not by itself grant a reuse license. A separate license decision may change this.

## Workflow

1. Keep changes focused on one feature or bug.
2. Follow the existing client/API/service patterns.
3. Use parameterized SQL and validate public input at both route and service boundaries.
4. Add focused regression tests, including ownership and privacy cases.
5. Run relevant builds, backend tests and Flutter checks.
6. Include screenshots for UI changes, using synthetic data only.
7. Document configuration and migration requirements.

Never commit passwords, private keys, production data, local environment files,
signing artifacts, generated dependency folders or unreviewed release binaries.
Do not test cleanup helpers against production databases.

## Pull Requests

Describe the problem, change, tests, screenshots and remaining limitations.
Call out schema updates, breaking API changes, dependency upgrades and deployment steps.
Do not claim a live workflow is verified using only mocked tests.
Security vulnerabilities must follow [private reporting guidance](SECURITY.md).
