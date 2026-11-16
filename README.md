# TaskFlow

TaskFlow is a Kanban task tracker built with Node.js, Express, and PostgreSQL. It supports multiple boards, task priorities, deadlines, tags, search and filters, Ukrainian and English, and a Pomodoro focus timer.

## Features

- Create, edit, move, and delete tasks across To Do, In Progress, and Done columns.
- Add a priority, optional deadline, and up to 10 comma-separated tags to each task.
- Search task titles and tags; filter by priority, tag, or deadline (overdue, due today, today and overdue, or future).
- Sort tasks by title, deadline, or priority.
- Use multiple boards, a calendar, basic productivity analytics, and the focus timer.
- Sign in to keep each user's boards, tasks, and preferences separate.

## Data model and storage

PostgreSQL stores users, boards, tasks, and login sessions. Each board belongs to a user, and each task belongs to a board; deleting a board also deletes its tasks. Task records include a title, status, priority, optional date, tags, and creation timestamp. The server validates input and uses parameterized SQL queries. PostgreSQL handles individual database writes; registration and legacy-data import use explicit transactions so their related changes succeed or roll back together. The server adds newly introduced task columns when it initializes the database, preserving existing task data.

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

## Basic usage

This is a web app, not a CLI; these are its five main user workflows:

1. Register or sign in.
2. Select a board or create a new one.
3. Add a task with a title; optionally set its priority, deadline, and comma-separated tags.
4. Search or filter tasks, then change their status using the status selector or by dragging a card between columns on desktop.
5. Edit a task with the edit button, or delete it with the delete button and confirm the prompt.

## Project level and side quests

TaskFlow targets the **Standard** level: it supports task creation, listing by Kanban status, editing, deletion, priorities, deadlines, tags, search, deadline and priority filters, and persistent storage in PostgreSQL.

It also includes selected **Advanced** side quests:

- Kanban web UI with drag-and-drop status changes.
- Multiple user accounts with separate boards and tasks.
- Calendar view and a basic statistics dashboard.
- Pomodoro focus timer. The timer is client-side and does not record completed sessions.

## Personal angle

The personal twist is a friendly cat mascot and playful visual themes for a productivity tool. The intent is to make planning feel more welcoming and less stressful while keeping the Kanban workflow clear.

## Screenshot

Add a screenshot of the board populated with your own real tasks. Do not use sample or invented task data as evidence.

<!-- Save the image as docs/screenshots/taskflow.png, then uncomment:
![TaskFlow board with real tasks](docs/screenshots/taskflow.png)
-->

## One week of use

Add a short, honest before/after note after using TaskFlow for a week: what felt inconvenient, what you changed, and whether the change helped. This section is intentionally not filled in until there is real usage experience to describe.

## Contributors

If this was a team project, list each member and their contribution here. If completed individually, replace this note with “Individual project.”

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