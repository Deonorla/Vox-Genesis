# Google Cloud Run Deployment Guide

## Overview

Google Cloud Run is a fully managed container platform that offers an **always-free tier**:
- **2 million requests/month** free
- **180,000 vCPU-seconds/month** free
- **360,000 GiB-seconds/month** memory free
- **1 GB outbound data** free per month
- **Scale-to-zero** — no traffic = no cost

New Google Cloud accounts also get **$300 free credits** for the first 90 days.

---

## Prerequisites

1. A Google Cloud account — [Sign up free](https://console.cloud.google.com/)
2. Google Cloud CLI (`gcloud`) installed — [Install gcloud](https://cloud.google.com/sdk/docs/install)
3. Docker installed (for local builds) — [Install Docker](https://docs.docker.com/get-docker/)
4. This repository cloned locally

---

## Step 1: Set Up Google Cloud CLI

### Install and initialize gcloud
```bash
# Install gcloud (macOS)
brew install --cask google-cloud-sdk

# Or download from https://cloud.google.com/sdk/docs/install

# Initialize gcloud (follow the interactive prompts)
gcloud init
```

### Authenticate with your Google account
```bash
gcloud auth login
```

### Create or select a project
```bash
# Create a new project (replace PROJECT_ID with your desired ID)
gcloud projects create voxgenesis --name="VoxGenesis"

# Or list existing projects
gcloud projects list

# Set your active project
gcloud config set project voxgenesis
```

### Enable required APIs
```bash
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

---

## Step 2: Build and Push the Docker Image

### Option A: Using Cloud Build (Recommended — no local Docker needed)

```bash
# Build the image using Google Cloud Build
gcloud builds submit --tag gcr.io/voxgenesis/voxgenesis-app
```

### Option B: Build Locally and Push

```bash
# Configure Docker for Google Container Registry
gcloud auth configure-docker

# Build the image locally
docker build -t gcr.io/voxgenesis/voxgenesis-app .

# Push to Google Container Registry
docker push gcr.io/voxgenesis/voxgenesis-app
```

> **Note:** The first build takes 2-3 minutes because it installs Python and edge-tts.

---

## Step 3: Deploy to Cloud Run

### Deploy the service
```bash
gcloud run deploy voxgenesis \
  --image gcr.io/voxgenesis/voxgenesis-app \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 120
```

### Parameter Explanation

| Parameter | Value | Description |
|-----------|-------|-------------|
| `--allow-unauthenticated` | — | Make the service publicly accessible |
| `--port 3000` | 3000 | Matches your Dockerfile EXPOSE port |
| `--memory 512Mi` | 512 MB | Enough for Node.js + edge-tts |
| `--cpu 1` | 1 vCPU | Standard allocation |
| `--min-instances 0` | 0 | Scale to zero when idle (free!) |
| `--max-instances 10` | 10 | Cap maximum instances |
| `--timeout 120` | 120 seconds | TTS generation may take time |

### Set Environment Variables
```bash
gcloud run services update voxgenesis \
  --update-env-vars NODE_ENV=production
```

### Your deployment URL
After deployment, Cloud Run provides a URL like:
```
https://voxgenesis-XXXXXX-uc.a.run.app
```

---

## Step 4: Update the Server Port (Important!)

Your `server.ts` already reads `PORT` from the environment, but Cloud Run expects the app to listen on the port specified by `--port` (or the `PORT` env var). Your current code does this correctly:

```typescript
const PORT = parseInt(process.env.PORT || '3000', 10);
```

Cloud Run automatically sets the `PORT` environment variable, so no changes are needed.

---

## Step 5: Configure a Custom Domain (Optional)

### Option A: Cloud Run Domain Mapping (Simple)
```bash
gcloud beta run domain-mappings create \
  --service voxgenesis \
  --domain yourdomain.com \
  --region us-central1
```

Then add the DNS records provided by Google to your domain registrar.

### Option B: Cloud CDN + Load Balancer (Production)
For production workloads, set up a Global External Application Load Balancer in front of Cloud Run for full TLS control, CDN, and Google Cloud Armor security.

---

## Step 6: Set Up Secret Manager (Optional)

For sensitive environment variables (API keys, etc.), use Secret Manager:

```bash
# Create a secret
echo -n "your-secret-value" | gcloud secrets create MY_SECRET --data-file=-

# Grant access to the Cloud Run service account
gcloud secrets add-iam-policy-binding MY_SECRET \
  --member="serviceAccount:voxgenesis@voxgenesis.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Bind the secret as an environment variable
gcloud run services update voxgenesis \
  --update-secrets MY_SECRET=MY_SECRET:latest
```

---

## Step 7: Set Up Auto-Deploy from GitHub (Optional)

### Using Cloud Build Triggers

```bash
# Connect your GitHub repository
gcloud builds triggers create github \
  --repo-name=VoxGenesis \
  --repo-owner=YOUR_GITHUB_USERNAME \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml
```

Create a `cloudbuild.yaml` in your repo root:
```yaml
steps:
  # Build the container image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/voxgenesis-app', '.']

  # Push the image to Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/voxgenesis-app']

  # Deploy to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    args:
      - 'gcloud'
      - 'run'
      - 'deploy'
      - 'voxgenesis'
      - '--image'
      - 'gcr.io/$PROJECT_ID/voxgenesis-app'
      - '--region'
      - 'us-central1'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'

images:
  - 'gcr.io/$PROJECT_ID/voxgenesis-app'
```

---

## Useful Commands

### View logs
```bash
gcloud run services logs read voxgenesis --region us-central1 --limit 50
```

### Update the service
```bash
gcloud run services update voxgenesis \
  --image gcr.io/voxgenesis/voxgenesis-app:latest \
  --region us-central1
```

### Check service status
```bash
gcloud run services describe voxgenesis --region us-central1
```

### Delete the service (to stop all costs)
```bash
gcloud run services delete voxgenesis --region us-central1
```

---

## Cost Optimization Tips

1. **Scale to zero** — `--min-instances 0` ensures no cost when idle
2. **Use Cloud Build** — 120 build-minutes/day free
3. **Monitor usage** — Check the [Cloud Run pricing page](https://cloud.google.com/run/pricing) for current rates
4. **Set billing alerts** — Get notified before exceeding free tier:
   ```bash
   gcloud billing budgets create \
     --billing-account=YOUR_BILLING_ACCOUNT \
     --display-name="Cloud Run Free Tier Alert" \
     --budget-amount=0 \
     --threshold-rule=percent=50 \
     --threshold-rule=percent=90
   ```

---

## Troubleshooting

### Build Fails
- Ensure Docker is running (if building locally)
- Check that Python and edge-tts install correctly in the Docker build
- View build logs: `gcloud builds list --limit=5` then `gcloud builds log BUILD_ID`

### Edge TTS Not Working
- The Dockerfile installs Python and edge-tts globally — verify the build output
- Check service logs for permission errors
- Ensure `edge-tts` is in the container's PATH

### Service Returns 502/503
- Check that the app listens on `0.0.0.0` (your server.ts does this correctly)
- Verify the PORT environment variable matches the `--port` flag
- Check logs: `gcloud run services logs read voxgenesis`

### Cold Starts
- Cloud Run scales from zero, so the first request after idle may take 5-10 seconds
- Set `--min-instances 1` if you need consistent response times (costs ~$5/month)

---

## Comparison: Cloud Run vs Railway

| Feature | Cloud Run | Railway |
|---------|-----------|---------|
| Free tier | 2M requests/month | $5 credit/month |
| Scale to zero | ✅ Yes | ✅ Yes |
| Docker support | ✅ Native | ✅ Native |
| Custom domains | ✅ Yes (free SSL) | ✅ Yes |
| Cold starts | 5-10s | 1-3s |
| Global regions | ✅ 30+ regions | ❌ Limited |
| Free outbound data | 1 GB/month | 100 GB/month |

---

## Quick Deploy Checklist

- [ ] Google Cloud account created
- [ ] gcloud CLI installed and authenticated
- [ ] Project created and billing enabled
- [ ] Cloud Run API enabled
- [ ] Docker image built and pushed
- [ ] Service deployed with correct PORT
- [ ] `--allow-unauthenticated` set for public access
- [ ] Custom domain configured (optional)
- [ ] Billing alerts set up

---

**Need help?** Check the [Cloud Run documentation](https://cloud.google.com/run/docs) or open an issue in the repository.
