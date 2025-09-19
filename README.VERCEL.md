Vercel deployment and secure environment setup

This guide shows the minimal steps to deploy the app to Vercel with Google Cloud Storage backups enabled while keeping credentials secure.

Required environment variables on Vercel (Project > Settings > Environment Variables):
- STORAGE_PROVIDER: gcs
- GCS_BUCKET: cointist-backups
- GCS_PROJECT_ID: cointist

Authentication options (choose one):
1) Use a service account JSON file via Vercel Secrets (recommended):
   - On your machine, create a Vercel secret from the JSON: `vercel secrets add gcs-key @/path/to/cointist-key.json`
   - In the Vercel Project Env, set `GCS_KEY_JSON` to the secret name: `@gcs-key`
   - The app reads `GCS_KEY_JSON` and parses JSON. This keeps the key out of plain envs.

2) Use Application Default Credentials via GOOGLE_APPLICATION_CREDENTIALS (less recommended on Vercel):
   - Not all hosting environments expose file paths reliably; prefer Vercel Secrets + `GCS_KEY_JSON`.

Notes and best practices:
- Do NOT commit service account JSON into the repo. `.gitignore` already excludes `cointist-*.json` and `*service-account*.json`.
- Use least-privilege service account: only grant `Storage Object Admin` or a narrower role that allows upload/list on the `cointist-backups` bucket.
- If you want to keep local backups on the server, set `GCS_KEEP_LOCAL=true`.
- The backup endpoint will upload to `backups/<filename>` in the bucket; the API returns a URL.

Vercel-specific steps summary:
1) Create project in Vercel and connect Git repository.
2) Add environment variables in Vercel Project Settings → Environment Variables:
   - For Production and Preview set `STORAGE_PROVIDER=gcs`, `GCS_BUCKET=cointist-backups`, `GCS_PROJECT_ID=cointist`.
3) Add service-account JSON as a Vercel secret and set `GCS_KEY_JSON=@gcs-key` in the envs.
4) Deploy. After deployment, use the Admin UI to create a backup and check the bucket.

Troubleshooting:
- If backups are still local, confirm the deployed runtime logs show `[admin/backup] uploaded backup -> ...`.
- Ensure the secret is correctly referenced (the `@secret-name` syntax) and the JSON is valid.

Security note:
- Rotate service account keys periodically and remove unused keys.

*** End of file ***
