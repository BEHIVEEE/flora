# Firebase Setup for OTP SMS

## 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Create a project"**
3. Enter project name: `Flora-Chemist`
4. Click **"Continue"**
5. Disable Google Analytics (optional)
6. Click **"Create project"**

## 2. Enable Phone Authentication

1. In Firebase Console, go to **Authentication**
2. Click **"Sign-in method"**
3. Click **"Phone"**
4. Toggle **"Enable"**
5. Save

## 3. Get Firebase Config

1. Go to **Project Settings** (gear icon)
2. Scroll to **"Your apps"**
3. Click **"Web"** icon
4. Copy the config object

It will look like:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  authDomain: "flora-chemist.firebaseapp.com",
  projectId: "flora-chemist-xxxxx",
  storageBucket: "flora-chemist-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:xxxxxxxxxxxxxxxx"
};
```

## 4. Add to `.env.local`

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=flora-chemist.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=flora-chemist-xxxxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=flora-chemist-xxxxx.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:xxxxxxxxxxxxxxxx
```

## 5. Install Firebase SDK

```bash
npm install firebase
```

## 6. Test Phone Authentication

Once configured, OTP will be sent via Firebase instead of console logs.

---

**Do you have a Firebase project set up?** If yes, share the config and I'll integrate it!
