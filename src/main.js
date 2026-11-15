const crypto = require('crypto');
const path = require('path');
require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('./storage/Database');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const SESSION_COOKIE = 'taskflow_session';
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'ui/public')));

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function requireValue(value, label, maxLength) {
  if (typeof value !== 'string') throw new HttpError(400, `${label} is required`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maxLength) {
    throw new HttpError(400, `${label} must be between 1 and ${maxLength} characters`);
  }
  return cleaned;
}

function validatePassword(password, label = 'Password') {
  if (typeof password !== 'string' || password.length < 10 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new HttpError(400, `${label} must be at least 10 characters and no more than 72 bytes`);
  }
}

function getUserView(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    avatar: user.avatar,
    language: user.language,
    theme: user.theme
  };
}

function validateAvatar(value) {
  const allowedEmoji = ['👤', '🐱', '🦊', '🚀', '👑', '⚡', '💻', '🌸', '🍕'];
  if (allowedEmoji.includes(value)) return value;
  if (typeof value !== 'string'
    || value.length > 1_500_000
    || !/^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+=*$/.test(value)) {
    throw new HttpError(400, 'Avatar must be a supported image smaller than 1 MB');
  }
  return value;
}

function readSessionToken(req) {
  const cookies = (req.headers.cookie || '').split(';');
  const sessionCookie = cookies.find(cookie => cookie.trim().startsWith(`${SESSION_COOKIE}=`));
  return sessionCookie ? decodeURIComponent(sessionCookie.trim().slice(SESSION_COOKIE.length + 1)) : null;
}

function setSessionCookie(res, token) {
  const secure = isProduction ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}${secure}`
  );
}

function clearSessionCookie(res) {
  const secure = isProduction ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`);
}

let requestCount = 0;
app.use(asyncHandler(async (req, res, next) => {
  const token = readSessionToken(req);
  if (token) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const result = await db.pool.query(`
      SELECT users.id, users.email, users.display_name, users.avatar, users.language, users.theme
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = $1 AND sessions.expires_at > $2
    `, [tokenHash, Math.floor(Date.now() / 1000)]);
    req.user = result.rows[0] || null;
  } else {
    req.user = null;
  }

  requestCount++;
  if (requestCount % 100 === 0) {
    db.pool.query('DELETE FROM sessions WHERE expires_at <= $1', [Math.floor(Date.now() / 1000)])
      .catch(error => console.error('Could not clean up expired sessions:', error));
  }
  next();
}));

function requireAuth(req, res, next) {
  if (!req.user) return next(new HttpError(401, 'Please sign in to continue'));
  next();
}

function verifySameOrigin(req, res, next) {
  const origin = req.get('origin');
  if (origin) {
    try {
      const requestOrigin = new URL(origin);
      if (requestOrigin.host !== req.get('host')
        || requestOrigin.protocol !== (req.secure ? 'https:' : 'http:')) {
        return next(new HttpError(403, 'Cross-origin request rejected'));
      }
    } catch (error) {
      return next(new HttpError(403, 'Cross-origin request rejected'));
    }
  }
  next();
}

const authAttempts = new Map();
function limitAuthAttempts(req, res, next) {
  const now = Date.now();
  const key = req.ip;
  if (authAttempts.size > 10_000) {
    for (const [ip, timestamps] of authAttempts) {
      if (!timestamps.some(timestamp => now - timestamp < 15 * 60 * 1000)) authAttempts.delete(ip);
    }
  }
  const recentAttempts = (authAttempts.get(key) || []).filter(timestamp => now - timestamp < 15 * 60 * 1000);
  if (recentAttempts.length >= 20) return next(new HttpError(429, 'Too many attempts. Please try again later.'));
  recentAttempts.push(now);
  authAttempts.set(key, recentAttempts);
  next();
}

async function createSession(userId, res) {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  await db.pool.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [
    tokenHash, userId, expiresAt
  ]);
  setSessionCookie(res, token);
}

app.post('/api/auth/register', verifySameOrigin, limitAuthAttempts, asyncHandler(async (req, res) => {
    const displayName = requireValue(req.body.displayName, 'Name', 80);
    const email = requireValue(req.body.email, 'Email', 254).toLowerCase();
    const password = req.body.password;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address');
    validatePassword(password);
    const language = ['uk', 'en'].includes(req.body.language) ? req.body.language : 'uk';

    const passwordHash = bcrypt.hashSync(password, 12);
    const user = await db.transaction(async client => {
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      await client.query(`
        INSERT INTO users (id, email, display_name, password_hash, language, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [id, email, displayName, passwordHash, language, createdAt]);
      await client.query(`
        INSERT INTO boards (id, owner_id, name, position, created_at)
        VALUES ($1, $2, $3, 0, $4)
      `, [
        crypto.randomUUID(),
        id,
        language === 'en' ? 'My first board' : 'Моя перша дошка',
        createdAt
      ]);
      const result = await client.query('SELECT * FROM users WHERE id = $1', [id]);
      return result.rows[0];
    });
    await createSession(user.id, res);
    res.status(201).json({ user: getUserView(user) });
}));

app.post('/api/auth/login', verifySameOrigin, limitAuthAttempts, asyncHandler(async (req, res) => {
    const email = requireValue(req.body.email, 'Email', 254).toLowerCase();
    const password = req.body.password;
    const result = await db.pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 72
      || !bcrypt.compareSync(password, user.password_hash)) {
      throw new HttpError(401, 'Email or password is incorrect');
    }
    await createSession(user.id, res);
    res.json({ user: getUserView(user) });
}));

app.get('/api/auth/me', (req, res) => {
  res.json({ user: req.user ? getUserView(req.user) : null });
});

app.post('/api/auth/logout', verifySameOrigin, asyncHandler(async (req, res) => {
  const token = readSessionToken(req);
  if (token) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await db.pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
  }
  clearSessionCookie(res);
  res.sendStatus(204);
}));

app.patch('/api/profile', verifySameOrigin, requireAuth, asyncHandler(async (req, res) => {
    const displayName = req.body.displayName === undefined
      ? req.user.display_name
      : requireValue(req.body.displayName, 'Name', 80);
    const avatar = req.body.avatar === undefined ? req.user.avatar : validateAvatar(req.body.avatar);
    const language = req.body.language === undefined ? req.user.language : req.body.language;
    const theme = req.body.theme === undefined ? req.user.theme : req.body.theme;
    if (!['uk', 'en'].includes(language)) throw new HttpError(400, 'Unsupported language');
    if (!['neon', 'cyberpunk', 'light'].includes(theme)) throw new HttpError(400, 'Unsupported theme');
    await db.pool.query(`
      UPDATE users SET display_name = $1, avatar = $2, language = $3, theme = $4 WHERE id = $5
    `, [displayName, avatar, language, theme, req.user.id]);
    const result = await db.pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    res.json({ user: getUserView(result.rows[0]) });
}));

app.post('/api/profile/password', verifySameOrigin, requireAuth, asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const result = await db.pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (typeof currentPassword !== 'string' || Buffer.byteLength(currentPassword, 'utf8') > 72
      || !bcrypt.compareSync(currentPassword, user.password_hash)) {
      throw new HttpError(400, 'Current password is incorrect');
    }
    validatePassword(newPassword, 'New password');
    await db.pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      bcrypt.hashSync(newPassword, 12), req.user.id
    ]);
    const currentToken = readSessionToken(req);
    const currentTokenHash = crypto.createHash('sha256').update(currentToken).digest('hex');
    await db.pool.query('DELETE FROM sessions WHERE user_id = $1 AND token_hash != $2', [
      req.user.id, currentTokenHash
    ]);
    res.sendStatus(204);
}));

app.delete('/api/account', verifySameOrigin, requireAuth, asyncHandler(async (req, res) => {
    const { password } = req.body;
    const result = await db.pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 72
      || !bcrypt.compareSync(password, user.password_hash)) {
      throw new HttpError(400, 'Password is incorrect');
    }
    await db.pool.query('DELETE FROM users WHERE id = $1', [req.user.id]);
    clearSessionCookie(res);
    res.sendStatus(204);
}));

app.get('/api/boards', requireAuth, asyncHandler(async (req, res) => {
  const result = await db.pool.query(`
    SELECT id, name, position
    FROM boards WHERE owner_id = $1
    ORDER BY position, created_at
  `, [req.user.id]);
  res.json({ boards: result.rows });
}));

app.post('/api/boards', verifySameOrigin, requireAuth, asyncHandler(async (req, res) => {
    const name = requireValue(req.body.name, 'Board name', 100);
    const positionResult = await db.pool.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS position FROM boards WHERE owner_id = $1',
      [req.user.id]
    );
    const position = positionResult.rows[0].position;
    const board = { id: crypto.randomUUID(), name, position };
    await db.pool.query(`
      INSERT INTO boards (id, owner_id, name, position, created_at) VALUES ($1, $2, $3, $4, $5)
    `, [board.id, req.user.id, board.name, board.position, new Date().toISOString()]);
    res.status(201).json({ board });
}));

app.patch('/api/boards/:boardId', verifySameOrigin, requireAuth, asyncHandler(async (req, res) => {
    const name = requireValue(req.body.name, 'Board name', 100);
    const result = await db.pool.query(
      'UPDATE boards SET name = $1 WHERE id = $2 AND owner_id = $3',
      [name, req.params.boardId, req.user.id]
    );
    if (!result.rowCount) throw new HttpError(404, 'Board not found');
    res.json({ board: { id: req.params.boardId, name } });
}));

app.delete('/api/boards/:boardId', verifySameOrigin, requireAuth, asyncHandler(async (req, res) => {
    const countResult = await db.pool.query('SELECT COUNT(*) AS count FROM boards WHERE owner_id = $1', [
      req.user.id
    ]);
    const count = Number(countResult.rows[0].count);
    if (count <= 1) throw new HttpError(400, 'Cannot delete the only board');
    const result = await db.pool.query('DELETE FROM boards WHERE id = $1 AND owner_id = $2', [
      req.params.boardId, req.user.id
    ]);
    if (!result.rowCount) throw new HttpError(404, 'Board not found');
    res.sendStatus(204);
}));

const requireOwnedBoard = asyncHandler(async (req, res, next) => {
  const result = await db.pool.query('SELECT id FROM boards WHERE id = $1 AND owner_id = $2', [
    req.params.boardId, req.user.id
  ]);
  const board = result.rows[0];
  if (!board) return next(new HttpError(404, 'Board not found'));
  req.board = board;
  next();
});

app.get('/api/boards/:boardId/tasks', requireAuth, requireOwnedBoard, asyncHandler(async (req, res) => {
  const result = await db.pool.query(`
    SELECT id, title, status, priority, due_date AS "dueDate", created_at AS "createdAt"
    FROM tasks WHERE board_id = $1
    ORDER BY created_at, id
  `, [req.board.id]);
  res.json({ tasks: result.rows });
}));

app.post('/api/boards/:boardId/tasks', verifySameOrigin, requireAuth, requireOwnedBoard, asyncHandler(async (req, res) => {
    const title = requireValue(req.body.title, 'Task title', 500);
    const status = req.body.status || 'todo';
    const priority = req.body.priority || 'Medium';
    const dueDate = req.body.dueDate || null;
    if (!['todo', 'in-progress', 'done'].includes(status)) throw new HttpError(400, 'Unsupported task status');
    if (!['Low', 'Medium', 'High'].includes(priority)) throw new HttpError(400, 'Unsupported task priority');
    if (dueDate !== null && (typeof dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate))) {
      throw new HttpError(400, 'Invalid due date');
    }
    const task = {
      id: crypto.randomUUID(),
      title,
      status,
      priority,
      dueDate,
      createdAt: new Date().toISOString()
    };
    await db.pool.query(`
      INSERT INTO tasks (id, board_id, title, status, priority, due_date, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [task.id, req.board.id, task.title, task.status, task.priority, task.dueDate, task.createdAt]);
    res.status(201).json({ task });
}));

app.patch('/api/boards/:boardId/tasks/:taskId', verifySameOrigin, requireAuth, requireOwnedBoard, asyncHandler(async (req, res) => {
    const status = req.body.status;
    if (!['todo', 'in-progress', 'done'].includes(status)) throw new HttpError(400, 'Unsupported task status');
    const result = await db.pool.query('UPDATE tasks SET status = $1 WHERE id = $2 AND board_id = $3', [
      status, req.params.taskId, req.board.id
    ]);
    if (!result.rowCount) throw new HttpError(404, 'Task not found');
    res.json({ id: req.params.taskId, status });
}));

app.post('/api/account/import', verifySameOrigin, requireAuth, asyncHandler(async (req, res) => {
    const { boards, tasksByBoard } = req.body;
    if (!Array.isArray(boards) || boards.length === 0 || boards.length > 100
      || !tasksByBoard || typeof tasksByBoard !== 'object' || Array.isArray(tasksByBoard)) {
      throw new HttpError(400, 'Invalid import data');
    }
    const totalTasks = Object.values(tasksByBoard).reduce(
      (total, tasks) => total + (Array.isArray(tasks) ? tasks.length : 0), 0
    );
    if (totalTasks > 5000) throw new HttpError(400, 'Import is too large');

    const boardRows = boards.map((board, index) => {
      const name = requireValue(typeof board === 'string' ? board : board.name, 'Board name', 100);
      const oldId = typeof board === 'string' ? String(index) : String(board.id || index);
      return { oldId, id: crypto.randomUUID(), name, position: index };
    });

    await db.transaction(async client => {
      const userResult = await client.query('SELECT legacy_imported FROM users WHERE id = $1 FOR UPDATE', [
        req.user.id
      ]);
      if (!userResult.rows[0] || userResult.rows[0].legacy_imported) {
        throw new HttpError(409, 'Data has already been imported');
      }

      await client.query('DELETE FROM boards WHERE owner_id = $1', [req.user.id]);
      for (const board of boardRows) {
        await client.query(`
          INSERT INTO boards (id, owner_id, name, position, created_at) VALUES ($1, $2, $3, $4, $5)
        `, [board.id, req.user.id, board.name, board.position, new Date().toISOString()]);
        const boardTasks = tasksByBoard[board.oldId];
        if (!Array.isArray(boardTasks)) continue;
        for (const oldTask of boardTasks) {
          if (!oldTask || typeof oldTask !== 'object') continue;
          const title = requireValue(oldTask.title, 'Task title', 500);
          const status = ['todo', 'in-progress', 'done'].includes(oldTask.status) ? oldTask.status : 'todo';
          const priority = ['Low', 'Medium', 'High'].includes(oldTask.priority) ? oldTask.priority : 'Medium';
          const dueDate = typeof oldTask.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(oldTask.dueDate)
            ? oldTask.dueDate
            : null;
          await client.query(`
            INSERT INTO tasks (id, board_id, title, status, priority, due_date, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            crypto.randomUUID(), board.id, title, status, priority, dueDate, new Date().toISOString()
          ]);
        }
      }
      await client.query('UPDATE users SET legacy_imported = TRUE WHERE id = $1', [req.user.id]);
    });

    res.json({ importedBoards: boardRows.length });
}));

app.use('/api', (req, res, next) => next(new HttpError(404, 'API endpoint not found')));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const isDuplicateRegistration = error.code === '23505' && req.path === '/api/auth/register';
  const status = isDuplicateRegistration
    ? 409
    : error instanceof HttpError
      ? error.status
      : Number(error.status) === 400
        ? 400
        : 500;
  if (status >= 500) console.error(error);
  const message = isDuplicateRegistration
    ? 'An account with this email already exists'
    : status >= 500
      ? 'Unexpected server error'
      : error.message || 'Invalid request';
  res.status(status).json({ error: message });
});

db.initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`TaskFlow is listening on port ${PORT}`);
    });
  })
  .catch(error => {
    console.error('Could not initialize PostgreSQL database:', error);
    process.exitCode = 1;
  });
