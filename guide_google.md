# Google Sign-In Guide (super simple)

This guide explains how "Sign in with Google" works in **Circle the date**, how to
check every part, and how to fix it when the APK doesn't work.

**Good news:** I tested your live server on 2026-07-06 and the server + Google
Cloud Console are already set up correctly. You most likely just need to
**rebuild the APK**. Details below.

---

## 1. How it works (the simple picture)

Think of it like passing a note in class:

1. You tap **"Sign in with Google"** in the app.
2. The app opens Google's login page.
3. You pick your Google account.
4. Google sends a secret note back to **your backend** (the Render server).
5. The backend checks the note, makes your account, and sends the app a
   one-time ticket using a special app link: `circlethedate://google-login`.
6. The app trades that ticket for a real login. You're in! 🎉

The important part: **the app and the website use the SAME backend and the SAME
Google settings.** So if Google login works on the website, Google is already
set up for the app too. Nothing new is needed in Google Cloud Console.

---

## 2. The 4 things that must all be true

| # | Thing | Where it lives | Your status (checked 2026-07-06) |
|---|-------|----------------|----------------------------------|
| 1 | Backend has Google keys | Render dashboard env vars | ✅ Working |
| 2 | Backend knows its own web address | Render env `API_PUBLIC_URL` | ✅ Working |
| 3 | Google Cloud has the callback link | Google Cloud Console | ✅ Working |
| 4 | The APK has the button + app link | The APK build | ⚠️ **Rebuild the APK** |

Only #4 is likely broken. Keep reading to check each one yourself.

---

## 3. Check it yourself (copy-paste, no coding needed)

Open a terminal and run these. You should see the same results.

### Check A — is Google turned on for the server?

```
curl -s https://bday-api-1j78.onrender.com/config
```

✅ You want to see: `"googleAuthAvailable":true`
❌ If it says `false` → the Render server is missing the Google keys (see Section 5).

### Check B — does the server send you to Google correctly?

```
curl -s -o /dev/null -D - "https://bday-api-1j78.onrender.com/auth/google/start?platform=app"
```

✅ You want to see a line starting with `location: https://accounts.google.com/...`
   and inside it `redirect_uri=https%3A%2F%2Fbday-api-1j78.onrender.com%2Fauth%2Fgoogle%2Fcallback`
❌ If it says `location: circlethedate://google-login?status=unavailable`
   → the server is missing the Google keys (see Section 5).

If both checks pass (yours do!), the server and Google are fine. The problem is
in the **APK**.

---

## 4. The most likely fix: rebuild the APK ⭐

The "Sign in with Google" button was added to the app on **2026-07-03**. If your
APK was built before that (or without the latest code), the button simply isn't
in it, or the app-link handoff is missing.

**Fix — build a fresh APK:**

```
cd "app"
eas build --profile preview --platform android
```

When it finishes, install that new APK on your phone and try again.

Two things are already correct in your project, so the fresh build will include them:

- The app link `circlethedate` is registered (in `app/app.json`, line `"scheme": "circlethedate"`).
- The APK points at the right backend (in `app/eas.json`,
  `EXPO_PUBLIC_API_URL = https://bday-api-1j78.onrender.com`).

### How to confirm the new APK is good

1. Open the app and go to the **Login** or **Sign up** screen.
2. You should see a **"Sign in with Google"** button under an **"or"** divider.
   - **No button?** The build is old, OR your phone can't reach the internet, OR
     the backend `/config` didn't load. Re-run Check A above on the same network.
3. Tap it → Google's page opens → pick your account → it should pop back into the
   app and log you in.

> ℹ️ **Important:** The Google button **only shows on a real phone/APK**, never on
> the web version of the app. That's on purpose — the `circlethedate://` app link
> can't work inside a web browser. So don't test app Google-login in a browser.

---

## 5. If Check A or B failed (server missing keys)

This should NOT happen for you (yours passed), but just in case:

1. Go to your **Render dashboard** → the `bday-api-1j78` service → **Environment**.
2. Make sure these exist (copy the values from your local `backend/.env`):
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `API_PUBLIC_URL` = `https://bday-api-1j78.onrender.com`
3. Click **Save** and let it redeploy.
4. Run Check A again — it should now say `true`.

---

## 6. If Google shows an error page after you tap the button

If tapping the button opens Google but Google says
**"Error 400: redirect_uri_mismatch"**, the callback link isn't registered.
(Yours IS registered — I verified it — but here's how to fix it if it ever breaks.)

1. Go to **Google Cloud Console** → **APIs & Services** → **Credentials**.
2. Click your **OAuth 2.0 Client ID** (the one starting `777579235375-...`).
3. Under **Authorized redirect URIs**, make sure ALL of these are listed:

   | Purpose | URL to add |
   |---------|------------|
   | App + website login | `https://bday-api-1j78.onrender.com/auth/google/callback` |
   | Gmail auto-send | `https://bday-api-1j78.onrender.com/integrations/gmail/callback` |
   | Local testing (optional) | `http://localhost:4040/auth/google/callback` |
   | Local testing (optional) | `http://localhost:4040/integrations/gmail/callback` |

4. Click **Save**. Changes can take a few minutes to take effect.

> The app and the website share the **same** login callback
> (`/auth/google/callback`). The app-vs-website difference is handled *inside* the
> backend, not by Google — so you do **not** need a separate Google entry for the app.

---

## 7. Quick troubleshooting table

| What you see | What's wrong | Fix |
|--------------|--------------|-----|
| No Google button in the APK | Old APK, or no internet | Rebuild APK (Section 4) |
| No Google button on web version | Normal! It's hidden on web | Test on a phone/APK |
| `/config` says `false` | Server missing keys | Section 5 |
| `/start` returns `...status=unavailable` | Server missing keys | Section 5 |
| Google says "redirect_uri_mismatch" | Callback not registered | Section 6 |
| Button works, but doesn't return to app | Old APK without app link | Rebuild APK (Section 4) |

---

## 8. One-line summary

Your **server and Google are already working**. Build a **new preview APK**
(`eas build --profile preview --platform android`), install it, and the
"Sign in with Google" button will be there and working on your phone.
