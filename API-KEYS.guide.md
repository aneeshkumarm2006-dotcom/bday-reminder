# API Keys Guide — Testing the App (Preview Build)

This guide explains, in plain steps, every API key the app needs, whether you
already have it, and exactly how to get the missing ones.

> **The big idea:** The app itself has **no secret keys inside it.** It just
> talks to your backend on Render (`https://bday-api-1j78.onrender.com`). All the
> real keys live on the **backend (Render dashboard → your service → Environment)**.
> The only app-build-specific thing is **push notification credentials (FCM)**.

---

## Quick status

| Key | What it's for | Do you have it? | Do you need it now? |
|-----|---------------|-----------------|---------------------|
| MongoDB URI | Database | ✅ Yes | Required |
| JWT secrets | Login | ✅ Yes | Required |
| Cloudinary | Photos | ✅ Yes | Nice to have |
| Google Client ID/Secret | Google sign-in + auto-email | ✅ Yes | Optional feature |
| Gmail token key | Encrypts Gmail tokens | ✅ Yes | Optional feature |
| **FCM (Firebase)** | **Push notifications on phone** | ❌ **No** | **Get this** |
| **Resend** | **Reminder + invite emails** | ❌ No (placeholder) | Get this |
| Twilio | Birthday SMS | ❌ No | Skip for now |
| Apple Developer | iPhone build + iOS push | ❌ No | Only if building for iPhone |

**You can build and install the preview APK RIGHT NOW without any new keys** —
you'll just have no push notifications and no email/SMS sending until you add the
keys below.

---

## ✅ Before anything: confirm Render has the keys

The app talks to Render, so the keys must be set **on Render**, not just on your
laptop.

1. Go to https://dashboard.render.com and open your backend service
   (`bday-api-1j78`).
2. Click **Environment** in the left menu.
3. Check that these are filled in (copy from your local `backend/.env` if missing):
   `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
   `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`,
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GMAIL_TOKEN_ENC_KEY`.
4. Also set `API_PUBLIC_URL=https://bday-api-1j78.onrender.com` and
   `APP_ORIGIN` / `WEBSITE_ORIGIN` to your real site URLs.

> If any are missing on Render, features silently turn off. Fix these first —
> it costs nothing and needs no new signup.

---

## 1. FCM (Firebase) — Push notifications on Android  ⭐ get this

Without this, push notifications will **not arrive** on a real Android phone in a
preview build. (In-app reminders still show; only pushed notifications need it.)

**Steps:**

1. Go to https://console.firebase.google.com and click **Add project**.
   - Name it e.g. `circle-the-date`. You can turn Google Analytics **off**.
2. Inside the project, click the **⚙️ gear → Project settings**.
3. Go to the **Cloud Messaging** tab. Make sure **Firebase Cloud Messaging API
   (V1)** is **Enabled** (if it says "manage in Google Cloud", click and enable).
4. Now create a **service account key** (this is the actual "key" file):
   - In Project settings → **Service accounts** tab → click
     **Generate new private key** → confirm. A `.json` file downloads.
   - Keep this file safe. **Do not commit it to git.**
5. Upload it to Expo so your builds can send push:
   - In a terminal, inside the `app/` folder, run:
     ```
     npx eas credentials
     ```
   - Choose **Android** → **production** (or the build profile) →
     **Google Service Account** → **Manage your Google Service Account Key for
     Push Notifications (FCM V1)** → **Upload a new key** → point it at the
     `.json` file you downloaded.

Done — push will now work in your preview build on Android.

> Tip: You'll also add the Firebase `google-services.json` (a different file from
> the "Add Android app" step in Firebase) if EAS asks for it during the build.
> When prompted, download the Android app config from Firebase and place it as
> `app/google-services.json`.

---

## 2. Resend — Reminder & invite emails

Without this, the app's own emails (birthday reminder emails to you, shared-list
invites) won't send. (Google/Gmail auto-send to friends is separate and already
works.)

**Steps:**

1. Go to https://resend.com and sign up (free tier is fine).
2. In the dashboard, click **API Keys → Create API Key**. Copy the key
   (starts with `re_...`).
3. Verify a sender:
   - Easiest for testing: use the built-in `onboarding@resend.dev` sender — no
     domain needed. Set `EMAIL_FROM="Circle the date <onboarding@resend.dev>"`.
   - For real use later: **Domains → Add Domain**, add the DNS records they show
     at your domain registrar, then use an address at that domain.
4. On **Render → Environment**, set:
   ```
   RESEND_API_KEY=re_your_real_key_here
   EMAIL_FROM=Circle the date <onboarding@resend.dev>
   ```
5. Save — Render redeploys automatically.

---

## 3. Twilio — Birthday SMS  (optional, skip for first test)

This lets the app auto-send a birthday **text**. It's heavier to set up (in the
US/Canada you must complete "A2P" carrier registration, which can take days), so
**skip it for your first preview build.**

When you're ready:

1. Sign up at https://www.twilio.com/try-twilio.
2. From the **Console dashboard**, copy your **Account SID** and **Auth Token**.
3. Buy a phone number (**Phone Numbers → Buy a number**) with SMS enabled, or
   create a **Messaging Service** (recommended).
4. Complete **A2P 10DLC / toll-free verification** for US/CA numbers.
5. On **Render → Environment**, set:
   ```
   TWILIO_ACCOUNT_SID=ACxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxx   (or TWILIO_FROM_NUMBER=+1...)
   TWILIO_MONTHLY_CAP=0
   ```

---

## 4. Apple Developer — only if building for iPhone

Android APK needs none of this. For an **iPhone** preview build you need:

1. An **Apple Developer account** — https://developer.apple.com/programs/
   ($99/year). Sign up with your Apple ID.
2. That's it for keys — EAS creates the push (APNs) key and signing certificates
   for you automatically during the build. Just log in when `eas build` asks.

---

## After you have the keys — build the preview

From the `app/` folder:

```bash
# one-time: install the EAS CLI and log in
npm install -g eas-cli
eas login          # use your Expo account (owner: aneeshautomations)

# build an installable Android APK you can put on your phone
eas build --profile preview --platform android
```

When it finishes, EAS gives you a link + QR code to download and install the APK
on your Android phone. (For iOS use `--platform ios`, which requires the Apple
Developer account above.)

---

## Summary — what to do right now

1. **Verify Render** has the keys you already own (Section ✅). Free, do first.
2. **Set up FCM** (Section 1) so push works. ~15 minutes.
3. **Set up Resend** (Section 2) so emails send. ~5 minutes.
4. Skip Twilio and Apple for now unless you specifically want SMS or an iPhone build.
5. Run the preview build command above.

When you've got the keys, paste them here and I'll help wire them into Render /
EAS and kick off the build.
