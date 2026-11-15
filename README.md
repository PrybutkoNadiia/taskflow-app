# TaskFlow

TaskFlow is a small Kanban task tracker built with Node.js and Express. The interface supports Ukrainian and English, multiple boards, and a Pomodoro focus timer.

## Run locally

Requirements: Node.js.

```bash
npm install
npm start
```

Open http://localhost:3000 in a browser.

Accounts, boards, tasks, and preferences are stored in SQLite. Passwords are hashed, and the login session is kept in an HTTP-only cookie for 30 days. Existing browser boards and tasks are imported once when a new account is registered.

## Hosting

This project uses an Express server, so GitHub Pages alone cannot run it. Deploy it to a Node.js host such as Render:

- Build command: `npm install`
- Start command: `npm start`
- Set `NODE_ENV` to `production`.
- Attach a persistent disk mounted at `/var/data`, then set `DATABASE_PATH` to `/var/data/taskflow.sqlite`.

The persistent disk is required: without it, a host can discard the SQLite database when the service restarts or redeploys. The included SQLite setup is suitable for a small project or demo on one server instance; use a managed database for multiple app instances or higher availability.

Registration is open to anyone who can reach the deployed site. Add email verification, password reset, and abuse protection before using it for sensitive or business-critical data.