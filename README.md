# TaskFlow

TaskFlow is a small Kanban task tracker built with Node.js and Express. The interface supports Ukrainian and English, multiple boards, and a Pomodoro focus timer.

## Run locally

Requirements: Node.js and a PostgreSQL database.

```bash
npm install
```

Create a `.env` file with your PostgreSQL connection string before starting:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require&channel_binding=require"
```

Then start the server:

```bash
npm start
```

Open http://localhost:3000 in a browser.

Accounts, boards, tasks, and preferences are stored in PostgreSQL. Passwords are hashed, and the login session is kept in an HTTP-only cookie for 30 days. Existing browser boards and tasks are imported once when a new account is registered.

## Hosting

This project uses an Express server, so GitHub Pages alone cannot run it. For a no-cost demo, create a PostgreSQL database on Neon and deploy the app as a free Node.js Web Service on Render:

- In Neon, create a project and copy its pooled PostgreSQL connection string.
- In Render, create a Web Service from this GitHub repository and select the `main` branch.
- Build command: `npm install`
- Start command: `npm start`
- Set `NODE_ENV` to `production`.
- Set `DATABASE_URL` to the Neon connection string. Keep it secret; do not commit it to GitHub.

No Render disk is needed because PostgreSQL is hosted separately. Free hosting plans have usage limits and may sleep when idle; Neon free databases also have resource limits. Check provider terms before relying on them for important data. Render's free Postgres databases expire after 30 days, so use a separate provider such as Neon's free plan for this demo.

Registration is open to anyone who can reach the deployed site. Add email verification, password reset, and abuse protection before using it for sensitive or business-critical data.