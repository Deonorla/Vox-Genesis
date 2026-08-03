# Railway Deployment Guide

## Prerequisites
1. A GitHub account with this repository pushed
2. A Railway account (https://railway.app)

## Step-by-Step Deployment

### 1. Push to GitHub
```bash
git add .
git commit -m "Add Railway deployment config"
git push origin main
```

### 2. Create Railway Project
1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub Repo"
4. Select your VoxGenesis repository
5. Railway will auto-detect the Dockerfile

### 3. Set Environment Variables
In Railway dashboard, go to your project → Variables tab and add:

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Enables production mode |

### 4. Deploy
Railway will automatically build and deploy your app. The first build may take 2-3 minutes (installing Python + edge-tts).

### 5. Get Your URL
After deployment, Railway provides a public URL like:
`https://your-app-name.up.railway.app`

## Troubleshooting

### Build Fails
- Check build logs in Railway dashboard
- Ensure all environment variables are set

### Edge TTS Not Working
- Verify Python is installed in the Docker build
- Check logs for any permission errors

## Local Development
```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

## Production Build
```bash
# Build frontend
npm run build

# Start production server
npm start
```
