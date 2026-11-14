# SohStx Health v0.1

Static, mobile-first, local-first health dashboard. No backend or subscription required.

## Publishing

1. Create a GitHub repository (private is fine) and upload all files in this folder to its root.
2. In Cloudflare, create a **Workers & Pages → Pages** project from that GitHub repository. Use the static-site option, no build command, and `/` as the output directory (Cloudflare may label this `.`).
3. Test the generated `*.pages.dev` URL.
4. Add `sohstx.com` as a custom domain in Pages and follow Cloudflare's displayed DNS instructions. If your domain DNS is at Porkbun, Cloudflare may require changing nameservers for the apex domain; do not change DNS blindly if you have existing email or other records.
5. Open the site in Android Chrome; use **Add to Home screen** or **Install app** when available.

## Privacy

- Imported CSV data and manual entries are stored in IndexedDB in **that browser profile on that device**, not on Cloudflare or GitHub.
- Static code files are public on the website, but your imported health records are not part of those files. **Never commit CSVs, JSON backups, or medical records to the GitHub repo or public website.**
- Browser storage can be deleted, lost or evicted. Download JSON backups regularly and keep them securely.
- No automatic synchronization between devices. HTTPS protects site delivery, but this prototype has no login or device-level encryption of IndexedDB data.
- Do not use this prototype for medical alerts, insulin dosing or treatment decisions.

## Data behavior

- Imports the observed 23-column Gluroo CSV schema, including quoted fields and multiline notes.
- Identical rows are deduplicated using a deterministic noncryptographic hash. A changed event can coexist with its prior version; manual reconciliation is not yet implemented.
- The latest reading and chart range are relative to the latest imported reading, not current time.
- The chart breaks lines at gaps over 15 minutes. Time in range uses available readings, not time-weighted coverage.
- Manual events support an estimated-time flag.
- Backup JSON contains all raw records; normalized CSV retains source fields and manual-event fields.

## Next releases

Event correction/reconciliation, date-range filtering for metrics, interactive chart tooltips, food-response overlays, stronger backup integrity checks, optional encrypted cross-device sync and accessible icons for Android installation.
