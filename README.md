# Smart Attendance Manager

This repo now includes a production-ready Smart Group Bunk Planner split into three layers:

- Shared planner engine in `src/`
- Node.js + Express backend in `server/`
- React frontend in `client/`

## Stack

- React for the frontend UI
- Node.js + Express for the API
- Supabase for attendance, profile, and friendship data
- Firebase Auth for authentication, with Firebase Admin verifying tokens on the backend

## Architecture

- The React app signs users in with Firebase Authentication.
- The frontend sends Firebase ID tokens to the Node API.
- The Node API verifies those tokens with Firebase Admin.
- The API reads attendance data from Supabase and builds the bunk plan with the shared planner engine.
- You can connect to Supabase either through `SUPABASE_SERVICE_ROLE_KEY` or through a direct `DATABASE_URL`.

## Project Structure

```text
.
|-- client/
|-- server/
|-- src/
`-- test/
```

## Environment Setup

Create these files before running the apps:

- `server/.env` from `server/.env.example`
- `client/.env` from `client/.env.example`

For your Supabase project, the backend is already templated with:

- `SUPABASE_URL=https://qprdxdsmdwpygohbpdsl.supabase.co`
- `DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.qprdxdsmdwpygohbpdsl.supabase.co:5432/postgres`

You still need to replace `[YOUR-PASSWORD]` with the real database password in `server/.env`.

## Run Locally

Install dependencies:

```bash
npm install
```

Run the backend:

```bash
npm run dev:server
```

Run the frontend:

```bash
npm run dev:client
```

Run the shared planner tests:

```bash
npm test
```

## Supabase Schema

Apply the SQL in `server/supabase/schema.sql` to your Supabase project.

## Notes

- In non-production mode, the backend supports a development auth fallback when Firebase credentials are not configured yet.
- The backend always includes the current signed-in user when calculating the group bunk plan, even if the user only selects friends in the UI.
