# Leave Ledger
Personal leave tracker for Android. Custom leave types, automatic LWP overflow, backup/restore.

## Get the APK
1. Create a **private** GitHub repo and upload all these files to it.
2. Wait ~5 min for the green tick under the **Actions** tab, then download the APK from **Releases**.
3. Every later push builds a new APK that installs over the old one and keeps your data.

The signing key lives in `keystore/` and must stay in the repo, and the repo must stay private. Never change `appId` in
`capacitor.config.ts`: same key + same id is what keeps your data on update.

## Moving data from the old app
Old app: Backup → Copy to clipboard. New app: More → Paste backup text → Import. Uninstall the old one afterwards.
