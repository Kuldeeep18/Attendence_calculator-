# Smart Attendance Manager

This repo now includes a production-ready Smart Group Bunk Planner with a real attendance sync flow:

- Shared planner engine in `src/`
- Node.js + Express backend in `server/`
- React frontend in `client/`

## Stack

- React for the frontend UI
- Node.js + Express for the API
- Supabase Postgres for attendance imports, linked student profiles, and friendship data
- Firebase Auth for authentication, with Firebase Admin verifying tokens on the backend

## Architecture

- The React app signs users in with Firebase Authentication.
- The frontend sends Firebase ID tokens to the Node API.
- The Node API verifies those tokens with Firebase Admin.
- The API imports weekly attendance PDFs into Supabase, lets users link themselves by enrollment number, accepts daily attendance updates, and builds the bunk plan from the latest subject totals.
- You can still connect through `SUPABASE_SERVICE_ROLE_KEY`, but the weekly import and daily update workflow expects `DATABASE_URL` so the backend can use SQL transactions.

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

Optional but recommended:

- `ADMIN_EMAILS=admin1@campus.edu,admin2@campus.edu`

Only these emails can upload the weekly PDFs in production. If `ADMIN_EMAILS` is empty, weekly import stays available only in non-production mode.

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

The schema now covers:

- `attendance_profiles` for Firebase-authenticated app users
- `attendance_students` for the imported weekly college roster
- `attendance_student_subjects` for live subject totals used by the planner
- `attendance_daily_logs` for per-day student adjustments between weekly imports
- `attendance_imports` for weekly PDF import history
- existing `friendships` and legacy `attendance_subjects`

## Weekly + Daily Workflow

1. Apply the Supabase schema and set `DATABASE_URL` in `server/.env`.
2. Start the backend and frontend.
3. Sign in as an admin account listed in `ADMIN_EMAILS`.
4. Upload the weekly college PDFs from the Attendance Sync panel.
5. Each student signs in and links their own enrollment number from the same weekly PDF.
6. Students use the Daily Update panel to mark which subjects were held and which ones they attended until the next weekly PDF arrives.
7. The planner uses the latest imported totals plus those daily updates.

## Notes

- In non-production mode, the backend supports a development auth fallback when Firebase credentials are not configured yet.
- The backend always includes the current signed-in user when calculating the group bunk plan, even if the user only selects friends in the UI.
- The PDF parser is currently tuned for the weekly Semester IV attendance format shown in the sample PDFs in the repo, with subject order: `PYTHON-2`, `COA`, `FSD-2`, `DM`, `TOC`.
