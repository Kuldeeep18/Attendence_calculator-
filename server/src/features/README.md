# Feature Modules

This folder groups backend capabilities by product feature:

- `attendance/` links profiles, weekly PDF imports, and daily attendance updates.
- `friends/` exposes friend selection and add-by-enrollment behavior.
- `planner/` handles group bunk plan generation and schedule recommendations.
- `health/` exposes API health status.

Cross-feature building blocks now live in `server/src/shared/services`.

Each feature exports a `router` so `server/src/app.js` can register API routes from one consistent location.
