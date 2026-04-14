# 🚀 Deployment Guide — Exam Duty Allocation & Management System

This app has **two parts** that need to be deployed separately:

| Part | Technology | Deploy To |
|------|------------|-----------|
| Frontend (React + Vite) | Static site | **Vercel** |
| Backend (Express API) | Node.js server | **Render** |
| Database | MySQL | **Railway** or **Render MySQL** |

---

## 📋 Table of Contents

1. [Step 1 — Deploy MySQL Database (Railway)](#step-1--deploy-mysql-database-railway)
2. [Step 2 — Deploy Backend on Render](#step-2--deploy-backend-on-render)
3. [Step 3 — Deploy Frontend on Vercel](#step-3--deploy-frontend-on-vercel)
4. [Step 4 — Connect everything](#step-4--connect-everything)
5. [Environment Variables Reference](#environment-variables-reference)
6. [Troubleshooting](#troubleshooting)

---

## Step 1 — Deploy MySQL Database (Railway)

Railway provides a free MySQL database — the easiest option for this project.

### 1.1 Create Railway account
1. Go to [https://railway.app](https://railway.app)
2. Sign up with GitHub

### 1.2 Create a MySQL database
1. Click **New Project** → **Deploy from template** → search **MySQL**
2. Click **Deploy** — Railway will spin up a MySQL instance
3. Once deployed, click on the **MySQL service**
4. Go to the **Variables** tab and copy these values:

   | Variable | What to copy |
   |----------|-------------|
   | `MYSQLHOST` | → your `DB_HOST` |
   | `MYSQLPORT` | → your `DB_PORT` |
   | `MYSQLUSER` | → your `DB_USER` |
   | `MYSQLPASSWORD` | → your `DB_PASSWORD` |
   | `MYSQLDATABASE` | → your `DB_NAME` |

> **Note:** The schema and tables are created automatically by the app on first boot — you don't need to import anything manually.

---

## Step 2 — Deploy Backend on Render

### 2.1 Prepare your repo
Make sure your code is pushed to GitHub.

```bash
git add .
git commit -m "prepare for deployment"
git push origin main
```

### 2.2 Create a Render account
1. Go to [https://render.com](https://render.com)
2. Sign up with GitHub

### 2.3 Create a new Web Service
1. Click **New** → **Web Service**
2. Connect your GitHub repository
3. Fill in the settings:

   | Field | Value |
   |-------|-------|
   | **Name** | `exam-duty-api` (or any name) |
   | **Region** | Closest to you |
   | **Branch** | `main` |
   | **Runtime** | `Node` |
   | **Build Command** | `npm install` |
   | **Start Command** | `node server/index.js` |
   | **Plan** | Free (or Starter for more uptime) |

### 2.4 Add Environment Variables on Render
Go to **Environment** tab and add these variables:

```
DB_HOST       = <your Railway MYSQLHOST>
DB_PORT       = <your Railway MYSQLPORT>
DB_USER       = <your Railway MYSQLUSER>
DB_PASSWORD   = <your Railway MYSQLPASSWORD>
DB_NAME       = <your Railway MYSQLDATABASE>
PORT          = 3001
CLIENT_ORIGIN = https://your-app-name.vercel.app
```

> ⚠️ Fill in `CLIENT_ORIGIN` **after** you deploy the frontend on Vercel (Step 3) and get the Vercel URL.

### 2.5 Deploy
- Click **Create Web Service**
- Wait for the build to finish (~2–3 minutes)
- Your backend URL will be something like: `https://exam-duty-api.onrender.com`
- Test it by visiting: `https://exam-duty-api.onrender.com/api/health`
  - You should see: `{ "status": "ok" }`

---

## Step 3 — Deploy Frontend on Vercel

### 3.1 Create a Vercel account
1. Go to [https://vercel.com](https://vercel.com)
2. Sign up with GitHub

### 3.2 Import your project
1. Click **Add New** → **Project**
2. Import your GitHub repository
3. Vercel auto-detects Vite — confirm these settings:

   | Field | Value |
   |-------|-------|
   | **Framework Preset** | `Vite` |
   | **Build Command** | `npm run build` |
   | **Output Directory** | `dist` |
   | **Install Command** | `npm install` |

### 3.3 Add Environment Variables on Vercel
Go to the **Environment Variables** section and add:

```
VITE_API_BASE_URL = https://exam-duty-api.onrender.com/api
```

> Replace `exam-duty-api.onrender.com` with your actual Render backend URL from Step 2.

### 3.4 Deploy
- Click **Deploy**
- Wait ~1–2 minutes
- Your frontend will be live at something like: `https://exam-duty-allocation.vercel.app`

---

## Step 4 — Connect Everything

After both are deployed:

### 4.1 Update CORS on Render
Go back to Render → your Web Service → **Environment** tab:
- Update `CLIENT_ORIGIN` to your actual Vercel URL:
  ```
  CLIENT_ORIGIN = https://exam-duty-allocation.vercel.app
  ```
- Click **Save Changes** — Render will redeploy automatically

### 4.2 Verify the full flow
1. Open your Vercel URL in the browser
2. Navigate to Dashboard — it should load without errors
3. Try uploading a faculty file to confirm the backend API works

---

## Environment Variables Reference

### Backend (`.env` / Render Dashboard)

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_HOST` | MySQL host | `monorail.proxy.rlwy.net` |
| `DB_PORT` | MySQL port | `12345` |
| `DB_USER` | MySQL username | `root` |
| `DB_PASSWORD` | MySQL password | `your-password` |
| `DB_NAME` | MySQL database name | `exam_duty_management` |
| `PORT` | Server port | `3001` |
| `CLIENT_ORIGIN` | Frontend URL for CORS | `https://your-app.vercel.app` |

### Frontend (`.env` / Vercel Dashboard)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Full URL of the backend API | `https://exam-duty-api.onrender.com/api` |

---

## Troubleshooting

### ❌ Frontend shows blank page or 404 on refresh
Add a `vercel.json` file in the project root:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Then redeploy on Vercel.

---

### ❌ API calls fail (CORS error in browser console)
- Make sure `CLIENT_ORIGIN` on Render exactly matches your Vercel URL (no trailing slash)
- Example: `https://exam-duty-allocation.vercel.app` ✅
- NOT: `https://exam-duty-allocation.vercel.app/` ❌

---

### ❌ Backend crashes with "Cannot connect to MySQL"
- Double-check all `DB_*` environment variables on Render
- Make sure the Railway database is not sleeping (free tier may sleep)
- Check Render logs: Render Dashboard → your service → **Logs** tab

---

### ❌ Render free tier spins down after inactivity
Render's free tier spins down after 15 minutes of inactivity. The first request after spin-down takes ~30 seconds.

**Fix:** Use [UptimeRobot](https://uptimerobot.com) (free) to ping your `/api/health` endpoint every 5 minutes and keep it alive.

---

### ❌ File uploads fail on Render
This app uses `multer` with in-memory storage — that's fine for Render. No extra config needed.

---

## 🔗 Quick Links

- Vercel: https://vercel.com
- Render: https://render.com
- Railway (MySQL): https://railway.app
- UptimeRobot (keep-alive): https://uptimerobot.com
