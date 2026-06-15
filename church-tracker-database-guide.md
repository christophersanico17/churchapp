# Church Tracker — Database & Cross-Device Guide
**New Life in Christ Fellowship · Congregation Tracker**

---

## How Your Data Is Stored

All church data (members, accounts, events, history) is saved as a single JSON object in your browser's **localStorage** under the key:

```
nlcf-church-data
```

This means data lives **only in the browser/device** you're using — it does not automatically sync to other devices. This guide shows you how to move your data anywhere.

---

## Option 1 — Export & Import (Simplest Way to Transfer)

This is the easiest method and requires no server setup.

### Step 1 — Export your data (on the current device)

Open your browser console (**F12 → Console tab**) and run:

```javascript
// This copies your church data to the clipboard as JSON
const data = localStorage.getItem('nlcf-church-data');
console.log(data); // Select all text here and copy it
```

Or to download it as a file directly:

```javascript
const data = localStorage.getItem('nlcf-church-data');
const blob = new Blob([data], { type: 'application/json' });
const a = document.createElement('a');
a.href = URL.createObjectURL(blob);
a.download = 'nlcf-backup.json';
a.click();
```

### Step 2 — Import your data (on the new device)

Open your browser console on the new device (**F12 → Console tab**) and paste:

```javascript
// Replace the text below with your actual exported JSON string
const myData = `PASTE YOUR JSON HERE`;
localStorage.setItem('nlcf-church-data', myData);
location.reload(); // Refresh the page
```

> **Tip:** Do this **before** logging in on the new device.

---

## Option 2 — Add an Export/Import Button to the App

You can add built-in export and import buttons to the tracker. Add this small function block at the bottom of `church-tracker.jsx` (before `window.App = App`), and call `<DataPortabilityBar />` inside the App's main `<div>`:

```jsx
function DataPortabilityBar() {
  const handleExport = () => {
    const data = localStorage.getItem('nlcf-church-data');
    if (!data) return alert('No data found.');
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nlcf-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          JSON.parse(ev.target.result); // validate
          localStorage.setItem('nlcf-church-data', ev.target.result);
          alert('Data imported! Reloading...');
          location.reload();
        } catch {
          alert('Invalid file. Please use a valid nlcf-backup.json file.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div style={{ display: 'flex', gap: '0.6rem', padding: '0.5rem 1.5rem', background: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' }}>
      <button onClick={handleExport} style={{ fontSize: '0.75rem', padding: '4px 12px', background: 'transparent', border: '1px solid rgba(212,175,55,0.4)', borderRadius: 6, color: '#d4af37', cursor: 'pointer' }}>⬇ Export Data</button>
      <button onClick={handleImport} style={{ fontSize: '0.75rem', padding: '4px 12px', background: 'transparent', border: '1px solid rgba(166,214,255,0.3)', borderRadius: 6, color: '#a9d6ff', cursor: 'pointer' }}>⬆ Import Data</button>
    </div>
  );
}
```

---

## Option 3 — Google Drive / Dropbox (Shared Folder)

1. Save your `index.html` and `church-tracker.jsx` to a shared Google Drive or Dropbox folder.
2. When you open the files from the same folder on different devices, the data still stays in each browser's localStorage — but the **Export/Import** buttons above let you share a single JSON file via the cloud folder.

**Workflow:**
- Device A: Export → save `nlcf-backup.json` to Google Drive
- Device B: Download `nlcf-backup.json` from Google Drive → Import

---

## Option 4 — Host It on a Free Server (Best for Multiple Users)

If multiple leaders/pastors need to access the same live data simultaneously, host the tracker on a free static hosting platform. The tracker already works as a static site (just two files).

### Recommended Free Hosts

| Platform | Steps |
|---|---|
| **GitHub Pages** | Upload files to a GitHub repo → Settings → Pages → Deploy from branch |
| **Netlify** | Drag your folder to [netlify.com/drop](https://app.netlify.com/drop) |
| **Vercel** | Connect your GitHub repo at [vercel.com](https://vercel.com) |

> **Note:** Even when hosted online, data is still per-browser unless you add a backend database. For true shared data, see Option 5.

---

## Option 5 — Cloud Database (Recommended for Churches with 20+ Members)

To make data truly shared and real-time across all devices, you need a cloud database. Here are the easiest options:

### Firebase (Google) — Free Tier

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a project → Add Firestore Database
3. Replace the `saveData` and `loadData` functions in `church-tracker.jsx` with Firebase calls:

```javascript
// At the top of church-tracker.jsx, add:
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "YOUR_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Replace saveData:
async function saveData(data) {
  await setDoc(doc(db, "church", "nlcf"), data);
}

// Replace loadData:
async function loadData() {
  const snap = await getDoc(doc(db, "church", "nlcf"));
  return snap.exists() ? snap.data() : null;
}
```

---

## Data Backup Schedule (Recommended)

| Frequency | Who | Action |
|---|---|---|
| Weekly | Admin | Export JSON backup → save to Google Drive |
| Before major changes | Admin | Export backup before deleting members |
| Monthly | Admin | Verify backup file can be re-imported |

---

## Troubleshooting

**"My data disappeared on a different browser/device"**
→ Data is browser-local. Use Export/Import to transfer it.

**"After reinstalling Chrome, my data is gone"**
→ Chrome clears localStorage on reinstall unless sync is enabled. Always keep a backup JSON.

**"I need multiple people to edit at the same time"**
→ Use Option 5 (Firebase) for real-time shared access.

**"Can I use this on mobile?"**
→ Yes. Open the `index.html` URL in your phone's browser. Use Chrome on Android or Safari on iOS. Data is saved locally on each phone separately.
