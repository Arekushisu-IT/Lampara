# LAMPARA Backend - Cloud Deployment Guide

## Step-by-Step: Deploy to Railway.app (Fastest Option)

### Prerequisites
- GitHub account with Lampara-Backend repository pushed
- Railway.app account (free tier available)

### Deployment Steps

#### 1. Create Railway Project
1. Go to https://railway.app/
2. Sign in with GitHub
3. Click "New Project"
4. Select "Provision MySQL" or "Deploy from GitHub"

#### 2. Add MySQL Database
1. In Railway dashboard, click "New"
2. Select "MySQL"
3. Wait for database creation
4. Copy connection credentials

#### 3. Connect GitHub Repository
1. Click "New" → "GitHub Repo"
2. Select your Lampara-Backend repository
3. Click "Deploy"

#### 4. Set Environment Variables
In Railway Dashboard → Variables:
```
DB_HOST=your_mysql_host
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=lampara_database
JWT_SECRET=your_very_secret_key_change_this
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://your-frontend-url.com
```

#### 5. Configure Build Settings
- Build Command: `npm install`
- Start Command: `npm start`

#### 6. Deploy Database Schema
1. Connect to MySQL via Railway
2. Run the `database.sql` schema
3. Verify tables are created

#### 7. Get Your Production URL
- Railway provides: `https://your-project-[random].railway.app`
- Use this URL in your frontend API calls

---

## Alternative: Deploy to Render.com

1. Go to https://render.com/
2. Create new Web Service
3. Connect GitHub repo
4. Create MySQL database
5. Set environment variables
6. Deploy

---

## Verify Deployment

Test your API endpoints:

```bash
# Health check
curl https://your-backend-url/api/health

# Login (should work)
curl -X POST https://your-backend-url/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@lampara.edu.ph","password":"SuperAdmin2026!"}'

# Get players
curl https://your-backend-url/api/players \
  -H "Authorization: Bearer <your_token>"
```

---

## Update Frontend to Use Cloud Backend

In your Lampara.html or Lampara.js, change:

```javascript
// Before (local)
const API_URL = 'http://localhost:5000/api';

// After (cloud)
const API_URL = 'https://your-backend-url/api';
```

---

## Troubleshooting

**Issue: Database errors after deployment**
- Ensure database.sql was run on cloud MySQL
- Check DATABASE_URL environment variable

**Issue: CORS error from frontend**
- Update FRONTEND_URL in Railway variables
- Restart the service

**Issue: 502 Bad Gateway**
- Check the build/deployment logs
- Verify all dependencies installed

---

**Ready?** Push your code to GitHub and deploy!
