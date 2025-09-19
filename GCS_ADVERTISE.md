# Host `/advertise` on Google Cloud Storage (GCS)

This describes the minimal steps to host the advertise HTML on a public GCS object and rewrite `/advertise` to it using the existing `vercel.json` rewrite.

Checklist
- Create a public `advertise.html` file containing the HTML you want served (copy the HTML from `pages/advertise.jsx`).
- Upload `advertise.html` to a GCS bucket and make it publicly readable.
- Replace `BUCKET_NAME` in `vercel.json` with your actual bucket name and deploy.

1) Create the HTML file

The project already contains the page markup in `pages/advertise.jsx`. The simplest option is to copy the HTML body into a new file named `advertise.html` in your local repo, or create it wherever convenient before upload.

2) Upload to GCS (PowerShell examples)

Replace `BUCKET_NAME` with your bucket. These commands assume you have `gsutil` available (part of Google Cloud SDK).

Upload the file:

```powershell
gsutil cp .\advertise.html gs://cointist-images/advertise.html
```

Make the object public (object ACL):

```powershell
gsutil acl ch -u AllUsers:R gs://cointist-images/advertise.html
```

Alternatively make the whole bucket public for objects (careful, broader permission):

```powershell
gsutil iam ch allUsers:objectViewer gs://cointist-images
```

Set caching metadata (optional):

```powershell
gsutil setmeta -h "Cache-Control:public, max-age=3600" gs://cointist-images/advertise.html
```

3) Verify the file is served

From PowerShell:

```powershell
curl https://storage.googleapis.com/cointist-images/advertise.html
```

You should see the HTML content in the response and be able to open the same HTTPS URL in a browser.

4) Update `vercel.json` and deploy

In this repo `vercel.json` has been updated to point `/advertise` to `https://storage.googleapis.com/cointist-images/advertise.html`. Commit the change and deploy to Vercel (the platform will apply the rewrite). Example steps:

- Edit `vercel.json`, replace `BUCKET_NAME`.
- Commit & push the change.
- Deploy via your normal flow (Vercel dashboard or `vercel --prod`).

Notes & caveats
- Vercel rewrites happen on the Vercel edge and will proxy requests to the GCS URL. Storage endpoints are HTTPS and supported.
- If you want to serve additional assets under `/advertise/*` make sure to upload the matching objects (for example `advertise/styles.css`), and update the rewrite for `:path*` accordingly.
- For faster updates, consider using versioned filenames (advertise-v1.html) or appropriate Cache-Control headers.

If you want, I can also add a small Node script to extract the HTML from `pages/advertise.jsx` and write `advertise.html` automatically—tell me if you want that and I'll add it.
