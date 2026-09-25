# SRMIST Attendance Health Dashboard

A local-first application to help SRMIST students maintain their attendance above 75% through smart calculations and predictions.

## Features
- Connect securely to your local SRMIST portal
- Predict attendance buffer and risks
- Calculate safe absences
- Fully local and private; zero persistent tracking

## Local-First Architecture
This app runs completely on your own machine. Your passwords never leave your browser context and are never stored.

## Deploying the frontend and backend

The frontend and backend are separate services in production. Set
`VITE_API_URL` in the frontend host (Vercel/Netlify) to the public origin of
the deployed backend, for example `https://your-backend.onrender.com`. Do not
include `/api` or a trailing slash. A template is available at
`frontend/.env.example`.

The backend needs Playwright Chromium installed and must remain running. After
changing a Vite environment variable, redeploy the frontend because Vite embeds
it at build time.

If the deployed site displays "Attendance service is temporarily unavailable",
open the browser network panel and check the `/api/health` request against the
value of `VITE_API_URL`. A missing variable makes a static frontend send `/api`
requests to itself, which cannot provide attendance data. For deployments that
do not run the backend, use **Portal Sync**: it imports the attendance table in
the browser and does not require sending SRMIST credentials to a cloud service.
