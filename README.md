# TaskFlow

TaskFlow is a web-based Kanban task tracker for organizing tasks by status, priority, deadline, and tags.

## Screenshot

<!-- Add your screenshot at docs/screenshots/taskflow-board.png -->
![TaskFlow board with real tasks](docs/screenshots/taskflow-board.png)

## Project level and side quests

**Level:** Standard.

The app supports task creation, listing by status, editing and deletion; priority and deadline fields; tags; search; filters by priority, tag, and deadline; and persistent PostgreSQL storage.

**Advanced side quests included:**

- Kanban web UI with drag-and-drop between status columns.
- Multiple accounts with separate boards and tasks.
- Calendar and basic productivity analytics.
- Pomodoro focus timer. It runs in the browser and does not save completed sessions.

## Personal twist

TaskFlow uses a friendly cat mascot and playful themes. This visual style is intended to make planning feel more welcoming and less stressful while keeping the task workflow clear.

## Run the app

Requirements: Node.js 20 or later and a PostgreSQL database.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file in the project root and set your PostgreSQL connection string:

   ```env
   DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE"
   ```

3. Start the server:

   ```bash
   npm start
   ```

4. Open http://localhost:3000.

This is a web app, not a CLI. Its five most useful actions are:

1. Register or sign in.
2. Create or select a board.
3. Create a task with a title and optional priority, deadline, and comma-separated tags.
4. Search or filter tasks, then change their status using the selector or desktop drag-and-drop.
5. Edit or delete a task.

## Data model

PostgreSQL stores users, boards, tasks, and login sessions. A board belongs to one user, and a task belongs to one board. A task has an ID, title, status, priority, creation timestamp, optional deadline, and a list of tags. Status and priority have defaults; tags default to an empty list. Deleting a user or board also deletes its related data.

## Storage atomicity

Task changes are sent to PostgreSQL as parameterized SQL statements, so each individual insert, update, or delete is handled as one database operation. Registration and legacy-data import change several related records, so those operations use explicit transactions: either all their changes are committed, or they are rolled back. PostgreSQL, rather than a JSON file, is the persistent storage layer.
