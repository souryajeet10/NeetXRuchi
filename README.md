# NeetXRuchi

**Made for Abhiruchi only ♡**

A personal pink NEET study tracker created for Abhiruchi's preparation, chapter progress and daily study plans. **Vercel hosts the website; Firebase stores accounts and progress.** No custom server, service-account keys, or environment variables are needed.

This dedication describes the intended user; it does not restrict website access to Abhiruchi automatically.

- Sign up with **your name only**. Firebase assigns IDs such as `NEETXRUCHI01`, `NEETXRUCHI02`.
- Sign in with **ID only**. ID matching ignores case; names with the same normalized spelling share a serial counter.
- Track studied/revised/PYQs, lectures, tests, daily plans and weekly targets. Includes responsive layouts and dark mode.
- No guest entry or connection settings in the user interface.

## Go live

1. In Firebase project **brainstormx-bddc1**, enable **Authentication → Sign-in method → Email/Password** and **Anonymous**. Anonymous authentication is a temporary signup step used to reserve one serial ID. The same UID is then linked to ID-based credentials; anonymous accounts cannot read or save study progress.
2. Open **Firestore Database → Rules**, paste [`firestore.rules`](firestore.rules), and **Publish**. These updated rules replace the earlier tracker-only rules; they also protect ID allocation and profiles.
3. Import this GitHub repository into Vercel. Use project **neetxruchi**, preset **Vite**, root **./**, build command **npm run build**, output **dist**. **Leave Environment Variables empty.** Public Firebase web configuration is already in `src/app.js`.
4. Add your final Vercel/custom domain under **Firebase Authentication → Settings → Authorized domains**. If you restrict the Firebase web API key by referrer, also allow that domain.
5. Create an account, save its ID, tick a chapter and wait for **Saved to your account**. Sign out and sign in on a second browser/device to check that the progress loads. Create a second account to verify it starts empty.

The first registration for a normalized name gets `01`; subsequent registrations get `02`, etc. Firestore allocates the number and profile in one transaction. Interrupted registrations can leave unused IDs; numbers are never reassigned. An interrupted signup in the same browser session resumes its existing reservation.

## Account behavior

This is deliberately **ID-only access**, with no PIN or password entered by the user. Anyone who knows or guesses an ID can access that account. Sequential IDs are predictable, so this is suitable only for non-sensitive study progress. Your name is requested only at signup.

Firebase Authentication uses an internal non-deliverable email alias and deterministic credential derived from the ID. This retains per-account storage and sessions, but it does not add secrecy beyond the ID. Users do not supply an email.

The app uses session persistence for sign-in. Unsaved offline edits stay in the open tab; keep it open until reconnected, and wait for a successful save before closing. Simultaneous changes on two devices are detected rather than silently overwritten.

 Administrators should monitor Firebase Auth quotas and usage; public registrations can consume serial numbers. The Firebase client API remains public, so the UI cannot prevent abuse by itself.

Previous `study_...` accounts remain in Firebase but still require the previous tracker. This release does not migrate those credentials or progress automatically.

The syllabus and **2 May 2027 planning target** came from the original tracker. The date is not represented as an official exam announcement.

## Development

Node 22 LTS:

```sh
npm ci
npm run dev
npm test
npm run build
```

For rules tests, install Firebase CLI and Java 21+, then run `npm run test:rules`. Tests use an isolated demo-project emulator, never production data. A GitHub Actions workflow runs the tests and production build.

Deploy rules with `firebase login` then `firebase deploy --only firestore:rules --project brainstormx-bddc1`, or use the Firebase console as described above.
