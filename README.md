# RailMaint development

## Start the app

Firebase Authentication checks the test email and password. After sign-in, the
frontend sends the Firebase ID token to Express, and Express verifies it with
Firebase Admin before allowing the login flow to continue. The password is not
sent to Express.

Run the frontend and backend in separate terminals from the repository root:

```powershell
npm run dev
```

```powershell
$env:FIREBASE_PROJECT_ID = "railmaint-a716b"
npm run dev:backend
```

The backend verifies Firebase ID tokens at `/api/auth/me`; it does not need to
check passwords or use a health-check route for this login flow.

The role selector currently controls dashboard navigation for testing only. It
does not grant authorization. Before enforcing real roles, assign them using
trusted server-side user data or Firebase custom claims; never trust the role
selected in the browser.
