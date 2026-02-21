# Cover Credit — Complete Free Deployment Guide
## From Zero to Live in ~45 Minutes

---

## WHAT YOU'LL SET UP (ALL FREE)

| Service        | What it does              | Cost         |
|----------------|---------------------------|--------------|
| GitHub         | Stores your code          | Free forever |
| MongoDB Atlas  | Cloud database            | Free (512MB) |
| Render         | Hosts your backend API    | Free tier    |
| Netlify        | Hosts your frontend       | Free forever |
| Gmail SMTP     | Email alerts on new leads | Free         |
| CallMeBot      | WhatsApp alerts           | Free         |

---

## STEP 1 — SET UP MONGODB ATLAS (Free Database)

1. Go to **https://cloud.mongodb.com** → Sign Up (use Google)

2. Click **"Build a Database"** → Choose **FREE (M0 Sandbox)**

3. Select **AWS** → Region: **Mumbai (ap-south-1)** → Click Create

4. **Username & Password screen:**
   - Username: `covercredit`
   - Password: click "Autogenerate" → COPY THIS PASSWORD AND SAVE IT
   - Click "Create User"

5. **Network Access screen:**
   - Click "Add IP Address"
   - Click **"Allow Access from Anywhere"** (0.0.0.0/0)
   - Click Confirm

6. Click **"Go to Database"**

7. Click **"Connect"** → **"Drivers"** → Copy the connection string

8. It looks like:
   ```
   mongodb+srv://covercredit:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

9. Replace `<password>` with your actual password, and add the database name:
   ```
   mongodb+srv://covercredit:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/covercredit?retryWrites=true&w=majority
   ```

10. **SAVE THIS URL** — you'll need it in Step 4

---

## STEP 2 — SET UP GMAIL APP PASSWORD (Free Email Alerts)

1. Go to your Google Account → **myaccount.google.com**

2. Click **Security** in the left sidebar

3. Make sure **2-Step Verification is ON** (required for App Passwords)

4. Search for **"App Passwords"** in the search bar at the top

5. App name: type `CoverCredit` → Click **Create**

6. Google will show a **16-character password** like: `xxxx xxxx xxxx xxxx`

7. **SAVE THIS PASSWORD** — you'll only see it once

---

## STEP 3 — SET UP CALLMEBOT WHATSAPP (Free WA Alerts)

1. Open WhatsApp on your phone

2. Save this number as a contact: **+34 644 59 72 87** (name it "CallMeBot")

3. Send this exact message to that number on WhatsApp:
   ```
   I allow callmebot to send me messages
   ```

4. Within a few minutes, CallMeBot will reply with your **API key** like:
   ```
   API Granted for phone +91XXXXXXXXXX. Your APIKEY is 1234567
   ```

5. **SAVE your phone number and API key**

---

## STEP 4 — PUSH CODE TO GITHUB

1. Go to **https://github.com** → Sign Up (free)

2. Create two repositories:
   - Click "New" → Name: `cover-credit-backend` → Public → Create
   - Click "New" → Name: `cover-credit-frontend` → Public → Create

3. Install Git if you don't have it: **https://git-scm.com/downloads**

4. Open terminal/command prompt in the `cover-credit-backend` folder:

   ```bash
   git init
   git add .
   git commit -m "Initial backend"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/cover-credit-backend.git
   git push -u origin main
   ```

5. Open terminal in the `cover-credit` folder (frontend):

   ```bash
   git init
   git add .
   git commit -m "Initial frontend"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/cover-credit-frontend.git
   git push -u origin main
   ```

---

## STEP 5 — DEPLOY BACKEND ON RENDER (Free)

1. Go to **https://render.com** → Sign Up with GitHub

2. Click **"New +"** → **"Web Service"**

3. Connect your **cover-credit-backend** repository

4. Fill in settings:
   - **Name:** `cover-credit-api`
   - **Region:** Singapore (closest to India)
   - **Branch:** main
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free

5. Click **"Advanced"** → **"Add Environment Variable"**

   Add these one by one (click "Add" after each):

   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | your MongoDB URI from Step 1 |
   | `JWT_SECRET` | any long random text (e.g. `CoverCredit2026SuperSecretKey!xyz789`) |
   | `ADMIN_EMAIL` | `admin@covercredit.in` (or any email you want) |
   | `ADMIN_PASSWORD` | a strong password you'll remember |
   | `EMAIL_USER` | your Gmail address |
   | `EMAIL_APP_PASSWORD` | the 16-char App Password from Step 2 |
   | `EMAIL_TO` | email where you want lead alerts (can be same Gmail) |
   | `WHATSAPP_TO` | your phone number e.g. `919642834789` (no + sign) |
   | `CALLMEBOT_APIKEY` | API key from Step 3 |
   | `FRONTEND_URL` | `https://covercredit.netlify.app` (update after Step 6) |

6. Click **"Create Web Service"**

7. Wait 3-4 minutes for deployment to finish

8. Your backend URL will be something like:
   ```
   https://cover-credit-api.onrender.com
   ```
   **SAVE THIS URL**

9. Test it: open in browser:
   ```
   https://cover-credit-api.onrender.com/api/health
   ```
   You should see: `{"success":true,"message":"Cover Credit API is running",...}`

---

## STEP 6 — UPDATE FRONTEND WITH YOUR BACKEND URL

1. Open `cover-credit/js/forms.js`

2. Find this line near the top:
   ```js
   const API_URL = 'https://cover-credit-api.onrender.com';
   ```

3. Replace `cover-credit-api` with your actual Render app name

4. Save the file

5. Push the change to GitHub:
   ```bash
   cd cover-credit
   git add js/forms.js
   git commit -m "Connect frontend to backend"
   git push
   ```

---

## STEP 7 — DEPLOY FRONTEND ON NETLIFY (Free)

### Option A: Drag & Drop (Easiest — no GitHub needed)

1. Go to **https://netlify.com** → Sign Up

2. On the dashboard, look for the box that says:
   **"Want to deploy a new site without connecting to Git?"**

3. Drag your entire `cover-credit` folder onto that box

4. Done! You'll get a URL like `https://amazing-curie-abc123.netlify.app`

### Option B: Connect GitHub (better for future updates)

1. Go to **https://netlify.com** → Sign Up with GitHub

2. Click **"Add new site"** → **"Import an existing project"**

3. Choose GitHub → Select `cover-credit-frontend`

4. Settings:
   - Branch: main
   - Build command: *(leave empty)*
   - Publish directory: `.` (just a dot)

5. Click **"Deploy site"**

6. Your frontend URL will look like: `https://covercredit.netlify.app`

---

## STEP 8 — UPDATE CORS IN RENDER

1. Go back to **Render** → Your backend service → **Environment**

2. Update `FRONTEND_URL` to your actual Netlify URL:
   ```
   https://covercredit.netlify.app
   ```

3. Click Save — Render will redeploy automatically (takes ~2 min)

---

## STEP 9 — ACCESS YOUR ADMIN DASHBOARD

1. Open in browser:
   ```
   https://cover-credit-api.onrender.com/admin
   ```

2. Log in with:
   - Email: whatever you set as `ADMIN_EMAIL`
   - Password: whatever you set as `ADMIN_PASSWORD`

3. You'll see:
   - 📊 Dashboard with live stats
   - 📅 All consultation bookings
   - 📩 All contact form submissions
   - Edit status, add notes, call directly

---

## STEP 10 — TEST EVERYTHING

1. Go to your live frontend URL (Netlify)

2. Fill in the Contact form with your own details → Submit

3. You should receive:
   - ✅ WhatsApp message on your phone
   - ✅ Email alert in your inbox
   - ✅ Entry in admin dashboard at /admin

4. Fill in the Book Consultation form → Submit

5. Same checks above

If anything doesn't work, check the **Render logs**:
Render Dashboard → Your service → **Logs** tab

---

## GETTING A CUSTOM DOMAIN (Optional — ₹700/yr)

1. Buy `covercredit.in` at **https://hostinger.in** (usually ₹699/yr)

2. In Netlify → Site Settings → Domain Management → Add custom domain
   - Type: `covercredit.in` → Verify → Add domain

3. In Hostinger → DNS Zone → Change nameservers to:
   ```
   dns1.p07.nsone.net
   dns2.p07.nsone.net
   dns3.p07.nsone.net
   dns4.p07.nsone.net
   ```

4. Wait 24-48 hours for DNS to propagate

5. Netlify automatically adds a **free SSL certificate** (the 🔒 padlock)

---

## MONTHLY COST SUMMARY

| Item | Cost |
|------|------|
| MongoDB Atlas (free tier) | ₹0/month |
| Render (free tier) | ₹0/month |
| Netlify (free tier) | ₹0/month |
| Gmail SMTP | ₹0/month |
| CallMeBot WhatsApp | ₹0/month |
| Domain (covercredit.in) | ₹58/month (₹700/yr) |
| **Total** | **₹0–58/month** |

---

## IMPORTANT NOTES

### Render Free Tier Behaviour
Render's free tier "spins down" the server after 15 minutes of inactivity.
The first form submission after inactivity may take 30-60 seconds to respond (cold start).
This is normal — subsequent requests are instant.

**To avoid cold starts:** Upgrade to Render's $7/month paid tier when you can afford it,
or use a free uptime monitor like **https://uptimerobot.com** to ping your API every 14 minutes.

### MongoDB Free Tier Limits
- 512MB storage (enough for thousands of leads)
- Upgrades are available if needed

### Backing Up Your Data
In MongoDB Atlas → your cluster → **"Collections"** — you can export all data as JSON anytime.

---

## QUICK REFERENCE

| What | URL |
|------|-----|
| Frontend (customer-facing) | https://covercredit.netlify.app |
| Backend API | https://cover-credit-api.onrender.com |
| Admin Dashboard | https://cover-credit-api.onrender.com/admin |
| API Health Check | https://cover-credit-api.onrender.com/api/health |
| MongoDB Atlas | https://cloud.mongodb.com |
| Render Dashboard | https://dashboard.render.com |

---

*Created for Cover Credit Insurance Advisors — AP & Telangana*
