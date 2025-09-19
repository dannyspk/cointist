Google Cloud Storage setup for this repo

This project already includes `src/lib/storage-gcs.js` which supports two ways to authenticate:

1) Provide the service-account JSON contents in the environment variable `GCS_KEY_JSON` (the code does JSON.parse(process.env.GCS_KEY_JSON)).
2) Use Application Default Credentials by setting `GOOGLE_APPLICATION_CREDENTIALS` to the JSON file path; the `@google-cloud/storage` library will pick this up automatically.

Recommended approach: use `GOOGLE_APPLICATION_CREDENTIALS` and keep the JSON file outside the repository.

PowerShell example (recommended, session-only):

# set env vars for this PowerShell session
$env:STORAGE_PROVIDER = 'gcs'
$env:GCS_BUCKET = 'your-bucket-name'
$env:GCS_PROJECT_ID = 'your-project-id'
$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\Users\Danish\Downloads\cointist-cc502bbafba0.json'

# start the dev server in the same session so the process inherits the vars
npm run dev

If you prefer to use `GCS_KEY_JSON` (not recommended for long-term since it stores secrets in env files):

# read the JSON file into the env var for this session
$env:STORAGE_PROVIDER = 'gcs'
$env:GCS_BUCKET = 'your-bucket-name'
$env:GCS_PROJECT_ID = 'your-project-id'
$env:GCS_KEY_JSON = Get-Content -Raw -Path 'C:\Users\Danish\Downloads\cointist-cc502bbafba0.json'

npm run dev

Notes and security:
- Do NOT commit the JSON key to git. Add its path or filename to `.gitignore` if you keep it in the repo root.
- Prefer storing credentials in your deployment environment (Vercel/Netlify/GCP) securely.
- If you need a persistent env file for local development, put non-secret flags (STORAGE_PROVIDER, GCS_BUCKET, GCS_PROJECT_ID) in `.env.local` and keep the JSON file outside the repo; use `GOOGLE_APPLICATION_CREDENTIALS` to reference it.

Quick verification:
- Upload endpoint: POST to `/api/admin/upload` (multipart/form-data). Requires admin auth.
- Backup endpoint: GET/POST to `/api/admin/backup` (requires admin). It will copy `prisma/dev.db` and, when `STORAGE_PROVIDER=gcs`, call `uploadFileToGcs`.

If you'd like, I can:
- Add an entry to `.gitignore` for your JSON file path.
- Create a sample `.env.local.example` with the non-secret keys.
- Attempt a local dry-run test (I will need your bucket name and permission to use the credentials or you can run the commands locally).

