# SohStx Health Vault — foundation (design only)

Status: NOT DEPLOYED. No medical data should be uploaded until security validation passes.

Target: vault.sohstx.com, independent from the existing public site and apps.

## Authentication
- Cloudflare Access with Google OAuth as the identity provider.
- Explicit allowlist of the owner's Google identity; require MFA at Google, and validate MFA enforcement in a real login test.
- Backend must validate Cloudflare Access JWT on every sensitive API request, with audience, issuer, expiry and signature checks.
- Fail closed for missing/invalid authentication. Disable caching for private content.
- No user medical information, tokens, secrets, or credentials in this public repository.

## Architecture
- Dedicated Cloudflare Worker for authenticated UI and API.
- D1 for structured readings, labs, medications, meals and audit metadata.
- Private R2 bucket for uploaded reports and attachments.
- Bindings and secrets, not public asset files, for backend resources.
- Separate development and production environments and data.
- Encryption in transit and at rest, data export, tested backup/restore, retention and deletion.
- Access logs without sensitive payloads. Limit upload types/sizes; validate imports.
- Design for personal use, not a claim of HIPAA compliance.

## Security gates before release
1. Configure Google OAuth provider in Cloudflare Access.
2. Create Access app for vault.sohstx.com with owner-only policy.
3. Confirm subdomain route maps only to the dedicated Worker.
4. Verify unauthenticated and wrong-account access is denied (UI, API, downloads).
5. Verify Google MFA and session expiration/revocation.
6. Verify private data cannot leak via CDN, browser caches, errors, logs or static files.
7. Verify backups and recovery; only then import actual records.

## First release
- Empty dashboard and authenticated navigation.
- Import glucose CSV, meal records, weight, blood pressure and labs.
- Charts for daily glucose patterns, time in range and nutrition correlation.
- PDF and CSV export, explicit user-controlled sharing.

Existing SohStx Personal, Clinical, Games and Mission Control deployments remain unchanged.
