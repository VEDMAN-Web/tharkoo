# Deploy: Vercel URL + DigitalOcean MongoDB

## Why this split

- **Vercel** creates the public URL, preview URLs, TLS, and CDN for the Next.js app.
- **DigitalOcean Managed MongoDB** holds listings, catalogue, and (later) wallets. It is not the public website.

The Node.js code is this Next.js app (Route Handlers + Server Components). There is no second server to deploy.

## DigitalOcean MongoDB

1. Create a Managed MongoDB cluster (same region as most Indian users if offered; otherwise closest).
2. Add Vercel’s egress IPs **or** allow the app with a user/password and TLS (`mongodb+srv://…`).
3. Database name: `tharkoo`.
4. Copy the connection string.

## Vercel

1. Import this Git repository.
2. Framework preset: Next.js. Build: `next build`. Output: default.
3. Environment variables (Production + Preview):

```
MONGODB_URI=mongodb+srv://USER:PASS@HOST/tharkoo?retryWrites=true&w=majority
NEXT_PUBLIC_SITE_URL=https://YOUR-VERCEL-URL
```

4. Deploy. Vercel prints the `.vercel.app` URL.
5. From your PC, seed once:

```bash
MONGODB_URI='mongodb+srv://…' npm run seed
```

## Later: DigitalOcean App Platform (optional)

Only if you want the Node process on DO as well. Point the app to the same `MONGODB_URI`. Keep Vercel if you still want their URLs, or switch DNS to DO. Do not run two production apps against one DB without a plan.

## Local vs production

| | Local | Production |
| --- | --- | --- |
| App | `npm run dev` :4317 | Vercel |
| Mongo | Docker compose or memory server | DigitalOcean |
| Seed | `npm run seed` | once against prod URI |
