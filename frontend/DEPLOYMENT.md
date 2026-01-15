# Vercel Deployment Guide

## ✅ Pre-Deployment Checklist

- [x] Frontend code in `/frontend` directory
- [x] Next.js App Router structure
- [x] Environment variables documented in `.env.example`
- [x] Git repository connected
- [x] MongoDB Atlas connection string ready
- [x] GitHub OAuth app configured

## 🚀 Vercel Configuration

### 1. Project Settings

**Framework Preset:** Next.js  
**Root Directory:** `frontend`  
**Build Command:** `npm run build` (default)  
**Output Directory:** `.next` (default)  
**Install Command:** `npm install` (default)  
**Node Version:** 18.x or higher

### 2. Environment Variables

Add these in Vercel Dashboard → Settings → Environment Variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `MONGODB_URI` | `mongodb+srv://...` | MongoDB Atlas connection string |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` | Your Vercel deployment URL |
| `NEXTAUTH_SECRET` | Generate with `openssl rand -base64 32` | Keep secret! |
| `GITHUB_CLIENT_ID` | From GitHub OAuth App | Production OAuth app |
| `GITHUB_CLIENT_SECRET` | From GitHub OAuth App | Keep secret! |
| `NEXT_PUBLIC_BACKEND_URL` | `https://your-backend.onrender.com` | Backend API URL |

**Apply to:** Production, Preview, Development (check all three)

### 3. GitHub OAuth Setup

Create a **separate** OAuth app for production:

1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Configure:
   - **Application name:** AutoReport (Production)
   - **Homepage URL:** `https://your-app.vercel.app`
   - **Authorization callback URL:** `https://your-app.vercel.app/api/auth/callback/github`
4. Save Client ID and Secret

### 4. Deploy Commands

```bash
# Commit all changes
git add .
git commit -m "chore: vercel deployment configuration"

# Push to GitHub (triggers auto-deploy)
git push origin master
```

## 🔍 Troubleshooting

### Build Failures

1. **Check Build Logs** → Vercel Dashboard → Deployments → Click deployment → View Function Logs
2. **Verify Environment Variables** → Settings → Environment Variables
3. **Check Node Version** → Ensure >= 18.0.0

### Runtime Errors

1. **Check Runtime Logs** → Deployments → Click deployment → Logs tab
2. **Test Health Endpoint** → Visit `/api/health` to verify API routes work
3. **Verify MongoDB Connection** → Check connection string in env vars

### OAuth Issues

1. **Callback URL Mismatch** → Ensure GitHub OAuth callback matches Vercel URL exactly
2. **NEXTAUTH_URL** → Must match your Vercel deployment URL
3. **Cookie Issues** → Ensure `NEXTAUTH_SECRET` is set and >= 32 characters

### Common Fixes

| Issue | Solution |
|-------|----------|
| 404 on all pages | Check Root Directory is set to `frontend` |
| Build succeeds but 500 errors | Check Runtime Logs for database connection issues |
| OAuth redirect fails | Update GitHub OAuth app callback URL |
| Middleware blocks requests | Check `src/middleware.js` matcher patterns |

## 📊 Monitoring

- **Health Check:** `https://your-app.vercel.app/api/health`
- **Vercel Analytics:** Enabled automatically
- **Logs:** Available for 24 hours on free tier

## 🔄 Redeployment

Automatic on every push to `master` branch.

Manual redeploy:
1. Vercel Dashboard → Deployments
2. Click "..." on deployment → Redeploy

## 📝 Post-Deployment

1. Test sign-in flow: `https://your-app.vercel.app/`
2. Verify dashboard loads: `/dashboard`
3. Check report viewer: `/project/[id]`
4. Monitor logs for errors in first 24 hours

## 🎯 Production Optimization

- Enable Vercel Analytics
- Configure custom domain (optional)
- Set up monitoring alerts
- Enable Edge Caching for API routes
- Configure ISR for dashboard pages
