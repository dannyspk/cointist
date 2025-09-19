This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/pages/api-reference/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `pages/index.tsx`. The page auto-updates as you edit the file.

[API routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes) can be accessed on [http://localhost:3000/api/hello](http://localhost:3000/api/hello). This endpoint can be edited in `pages/api/hello.ts`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes) instead of React pages.

This project uses [`next/font`](https://nextjs.org/docs/pages/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn-pages-router) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/pages/building-your-application/deploying) for more details.

## Publish webhook (optional)

You can add a simple publish webhook to regenerate the static `public/sitemap.xml`, warm the CDN edge, and ping Google. Add the following environment variable in Vercel (or your host): `PUBLISH_HOOK_SECRET`.

Example curl to call the webhook after publishing a new article:

```powershell
curl -X POST "https://your-deployment.vercel.app/api/publish-hook" -H "x-publish-secret: YOUR_SECRET"
```

The route will run the `scripts/generate-static-sitemap.js` generator, fetch the sitemap once to warm the edge, and call Google's sitemap ping endpoint.

## GitHub Actions: call publish webhook on content changes

You can configure a small GitHub Actions workflow which calls the deployed publish webhook when content files change. Add two repository secrets:

- `PUBLISH_HOOK_URL` - full URL to your deployed webhook, e.g. `https://your-deployment.vercel.app/api/publish-hook`
- `PUBLISH_HOOK_SECRET` - the same secret value set in your Vercel project environment

The repository includes `.github/workflows/publish-hook.yml` which triggers on pushes to `guides/**`, `pages/articles/**`, and `data/**` and can also be run manually from the Actions UI.

