# Peerly-AI-Powered-Forum-FYP-

## Google SSO starter

This project now uses one root environment file for Google sign-in.

### 1. Add your Google OAuth values

Update [`.env`](C:/Users/Chun%20Meng/OneDrive%20-%20Sunway%20Education%20Group/SET_SEM_8/FYP/.env) with:

```env
HOST=localhost
PORT=3530
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3530/auth/google/callback
```

### 2. Configure Google Cloud Console

Create an OAuth 2.0 Web application and add:

- Authorized JavaScript origins: `http://localhost:3530`
- Authorized redirect URI: `http://localhost:3530/auth/google/callback`

### 3. Run the starter

```bash
npm start
```

Then open:

- `http://localhost:3530/` for the landing page
- `http://localhost:3530/login` for the login page

### 4. How it is structured

- Backend route `/auth/google/start` builds the Google URL using the server-side env values.
- Backend route `/auth/google/callback` exchanges the auth code and fetches the Google profile.
- Frontend login page only redirects the user to the backend auth route.

This keeps the secret on the backend while still letting users sign in with Gmail from the login screen.
