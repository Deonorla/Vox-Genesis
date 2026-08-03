# Render Deployment Guide

## Overview

[Render](https://render.com/) is a unified cloud platform for building and running apps with:
- **Free tier** for hobby projects (512 MB RAM, 0.1 CPU)
- **Automatic deploys** from GitHub
- **Docker support** for custom runtimes
- **Free SSL** and custom domains
- **Scale-to-zero** capability

---

## Prerequisites

1. A Render account — [Sign up free](https://render.com/)
2. Your VoxGenesis repository connected to GitHub

---

## Step 1: Create a New Web Service

1. Log in to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New"** → **"Web Service"**
3. Connect your GitHub repository (`Deonorla/VoxGenesis`)

---

## Step 2: Configure Service Settings

Fill in the following fields:

| Setting | Value | Description |
|---------|-------|-------------|
| **Name** | `VoxGenesis` | Unique service name |
| **Runtime** | `Docker` | Uses your Dockerfile |
| **Branch** | `main` | Git branch to build |
| **Region** | `Oregon (US West)` | Or closest to your users |
| **Root Directory** | *(leave empty)* | Dockerfile is at repo root |
| **Instance Type** | `Free` | $0/month for hobby projects |

---

## Step 3: Set Environment Variables

Click **"Add Environment Variable"** and add:

| NAME | VALUE | Purpose |
|------|-------|---------|
| `NODE_ENV` | `production` | Enables production mode |
| `PORT` | `10000` | Render's default (optional - Render sets this) |

### Optional Environment Variables

| NAME | VALUE | Purpose |
|------|-------|---------|
| `APP_URL` | `https://voxgenesis.onrender.com` | Your app's URL (add after deployment) |

---

## Step 4: Deploy

1. Click **"Create Web Service"**
2. Render will automatically:
   - Pull your code from GitHub
   - Build the Docker image
   - Install Python and edge-tts (via Dockerfile)
   - Start the production server

---

## How It Works

Your Dockerfile handles the entire build process:

```dockerfile
# Installs Python + edge-tts
RUN pip3 install edge-tts

# Builds the frontend (Vite + React)
RUN npm run build

# Starts the production server
CMD ["npm", "start"]
```

The server:
1. Serves the built React app as static files
2. Provides `/api/edge-tts` endpoint for TTS generation
3. Listens on the `PORT` environment variable (or 3000)

---

## Free Tier Limitations

| Feature | Free Tier |
|---------|-----------|
| RAM | 512 MB |
| CPU | 0.1 |
| Bandwidth | 100 GB/month |
| Build time | 500 minutes/month |
| Spin-down | After inactivity |
| Cold start | 30-60 seconds |

**Tip:** Free instances spin down after inactivity. The first request after idle takes 30-60 seconds.

---

## Custom Domain Setup (Optional)

1. Go to your service → **Settings** → **Custom Domains**
2. Add your domain (e.g., `voxgenesis.com`)
3. Add DNS records at your domain registrar:

```
Type: CNAME
Name: @ (or www)
Value: voxgenesis.onrender.com
```

4. SSL certificate is automatically provisioned

---

## Auto-Deploy from GitHub

Render automatically deploys when you push to the connected branch (`main`).

To disable auto-deploy:
1. Go to **Settings** → **Build & Deploy**
2. Toggle off **"Auto Deploy"**

---

## Useful Commands

### View Logs
1. Go to your service → **Logs** tab
2. Filter by level (Info, Warn, Error)

### Manual Deploy
1. Go to **Manual Deploy** → **Clear build cache & deploy**

### Check Service Status
- Dashboard shows current status (Live, Deploying, Sleeping)

---

## Troubleshooting

### Build Fails
- Check that your Dockerfile is at the repo root
- View build logs for Python/edge-tts installation errors
- Ensure all dependencies are in `package.json`

### Edge TTS Not Working
- Verify Python and edge-tts installed in Docker build
- Check runtime logs for permission errors
- Ensure `edge-tts` is in the container's PATH

### Service Returns 502/503
- Check that the app listens on `0.0.0.0` (your server.ts does this)
- Verify `PORT` environment variable is set correctly
- View service logs for startup errors

### Cold Starts Too Slow
- Consider upgrading to **Starter** ($7/month) for faster cold starts
- Or set minimum instances to 1 (paid plans only)

---

## Upgrade Options

| Instance | Price | RAM | CPU | Features |
|----------|-------|-----|-----|----------|
| Free | $0/month | 512 MB | 0.1 | Basic |
| Starter | $7/month | 512 MB | 0.5 | No spin-down |
| Standard | $25/month | 2 GB | 1 | Production-ready |
| Pro | $85/month | 4 GB | 2 | High performance |

---

## Comparison: Render vs Other Platforms

| Feature | Render | Railway | Cloud Run |
|---------|--------|---------|-----------|
| Free tier | ✅ Yes | ✅ $5 credit | ✅ 2M requests |
| Docker | ✅ Native | ✅ Native | ✅ Native |
| Spin-down | ✅ Yes | ✅ Yes | ✅ Yes |
| Custom domains | ✅ Free SSL | ✅ Yes | ✅ Free SSL |
| Cold start | 30-60s | 1-3s | 5-10s |
| Regions | 15+ | Limited | 30+ |

---

## Quick Deploy Checklist

- [ ] Render account created
- [ ] GitHub repository connected
- [ ] Service configured as Docker
- [ ] `NODE_ENV=production` set
- [ ] Deploy triggered
- [ ] Service status shows "Live"
- [ ] Test the application
- [ ] Custom domain configured (optional)

---

## Need Help?

- [Render Documentation](https://render.com/docs)
- [Render Status Page](https://status.render.com/)
- [Community Forum](https://community.render.com/)
