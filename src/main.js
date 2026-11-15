const crypto = require('crypto');
const path = require('path');
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

const sessionLookup = db.prepare(`
  SELECT users.id, users.email, users.display_name, users.avatar, users.language, users.theme
  FROM sessions
  JOIN users ON users.id = sessions.user_id
  WHERE sessions.token_hash = ? AND sessions.expires_at > ?
`);
let requestCount = 0;
app.use((req, res, next) => {
  const token = readSessionToken(req);
  if (token) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    req.user = sessionLookup.get(tokenHash, Math.floor(Date.now() / 1000)) || null;
  } else {
    req.user = null;
  }

  requestCount++;
  if (requestCount % 100 === 0) {
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Math.floor(Date.now() / 1000));
  }
  next();
});

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

function createSession(userId, res) {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(tokenHash, userId, expiresAt);
  setSessionCookie(res, token);
}

const createDefaultBoard = db.prepare(`
  INSERT INTO boards (id, owner_id, name, position, created_at)
  VALUES (?, ?, ?, 0, ?)
`);
const createUser = db.transaction(({ email, displayName, passwordHash, language }) => {
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO users (id, email, display_name, password_hash, language, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, email, displayName, passwordHash, language, new Date().toISOString());
  createDefaultBoard.run(
    crypto.randomUUID(),
    id,
    language === 'en' ? 'My first board' : 'Моя перша дошка',
    new Date().toISOString()
  );
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
});

app.post('/api/auth/register', verifySameOrigin, limitAuthAttempts, (req, res, next) => {
  try {
    const displayName = requireValue(req.body.displayName, 'Name', 80);
    const email = requireValue(req.body.email, 'Email', 254).toLowerCase();
    const password = req.body.password;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address');
    validatePassword(password);
    const language = ['uk', 'en'].includes(req.body.language) ? req.body.language : 'uk';

    const passwordHash = bcrypt.hashSync(password, 12);
    const user = createUser({ email, displayName, passwordHash, language });
    createSession(user.id, res);
    res.status(201).json({ user: getUserView(user) });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return next(new HttpError(409, 'An account with this email already exists'));
    }
    next(error);
  }
});

app.post('/api/auth/login', verifySameOrigin, limitAuthAttempts, (req, res, next) => {
  try {
    const email = requireValue(req.body.email, 'Email', 254).toLowerCase();
    const password = req.body.password;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 72
      || !bcrypt.compareSync(password, user.password_hash)) {
      throw new HttpError(401, 'Email or password is incorrect');
    }
    createSession(user.id, res);
    res.json({ user: getUserView(user) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/me', (req, res) => {
  res.json({ user: req.user ? getUserView(req.user) : null });
});

app.post('/api/auth/logout', verifySameOrigin, (req, res) => {
  const token = readSessionToken(req);
  if (token) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
  }
  clearSessionCookie(res);
  res.sendStatus(204);
});

app.patch('/api/profile', verifySameOrigin, requireAuth, (req, res, next) => {
  try {
    const displayName = req.body.displayName === undefined
      ? req.user.display_name
      : requireValue(req.body.displayName, 'Name', 80);
    const avatar = req.body.avatar === undefined ? req.user.avatar : validateAvatar(req.body.avatar);
    const language = req.body.language === undefined ? req.user.language : req.body.language;
    const theme = req.body.theme === undefined ? req.user.theme : req.body.theme;
    if (!['uk', 'en'].includes(language)) throw new HttpError(400, 'Unsupported language');
    if (!['neon', 'cyberpunk', 'light'].includes(theme)) throw new HttpError(400, 'Unsupported theme');
    db.prepare('UPDATE users SET display_name = ?, avatar = ?, language = ?, theme = ? WHERE id = ?')
      .run(displayName, avatar, language, theme, req.user.id);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json({ user: getUserView(user) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/profile/password', verifySameOrigin, requireAuth, (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    if (typeof currentPassword !== 'string' || Buffer.byteLength(currentPassword, 'utf8') > 72
      || !bcrypt.compareSync(currentPassword, user.password_hash)) {
      throw new HttpError(400, 'Current password is incorrect');
    }
    validatePassword(newPassword, 'New password');
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .run(bcrypt.hashSync(newPassword, 12), req.user.id);
    const currentToken = readSessionToken(req);
    const currentTokenHash = crypto.createHash('sha256').update(currentToken).digest('hex');
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?')
      .run(req.user.id, currentTokenHash);
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/account', verifySameOrigin, requireAuth, (req, res, next) => {
  try {
    const { password } = req.body;
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    if (typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 72
      || !bcrypt.compareSync(password, user.password_hash)) {
      throw new HttpError(400, 'Password is incorrect');
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
    clearSessionCookie(res);
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
});

app.get('/api/boards', requireAuth, (req, res) => {
  const boards = db.prepare(`
    SELECT id, name, position
    FROM boards WHERE owner_id = ?
    ORDER BY position, created_at
  `).all(req.user.id);
  res.json({ boards });
});

app.post('/api/boards', verifySameOrigin, requireAuth, (req, res, next) => {
  try {
    const name = requireValue(req.body.name, 'Board name', 100);
    const position = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS position FROM boards WHERE owner_id = ?')
      .get(req.user.id).position;
    const board = { id: crypto.randomUUID(), name, position };
    db.prepare('INSERT INTO boards (id, owner_id, name, position, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(board.id, req.user.id, board.name, board.position, new Date().toISOString());
    res.status(201).json({ board });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/boards/:boardId', verifySameOrigin, requireAuth, (req, res, next) => {
  try {
    const name = requireValue(req.body.name, 'Board name', 100);
    const result = db.prepare('UPDATE boards SET name = ? WHERE id = ? AND owner_id = ?')
      .run(name, req.params.boardId, req.user.id);
    if (!result.changes) throw new HttpError(404, 'Board not found');
    res.json({ board: { id: req.params.boardId, name } });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/boards/:boardId', verifySameOrigin, requireAuth, (req, res, next) => {
  try {
    const count = db.prepare('SELECT COUNT(*) AS count FROM boards WHERE owner_id = ?').get(req.user.id).count;
    if (count <= 1) throw new HttpError(400, 'Cannot delete the only board');
    const result = db.prepare('DELETE FROM boards WHERE id = ? AND owner_id = ?')
      .run(req.params.boardId, req.user.id);
    if (!result.changes) throw new HttpError(404, 'Board not found');
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
});

function requireOwnedBoard(req, res, next) {
  const board = db.prepare('SELECT id FROM boards WHERE id = ? AND owner_id = ?')
    .get(req.params.boardId, req.user.id);
  if (!board) return next(new HttpError(404, 'Board not found'));
  req.board = board;
  next();
}

app.get('/api/boards/:boardId/tasks', requireAuth, requireOwnedBoard, (req, res) => {
  const tasks = db.prepare(`
    SELECT id, title, status, priority, due_date AS dueDate, created_at AS createdAt
    FROM tasks WHERE board_id = ?
    ORDER BY created_at, rowid
  `).all(req.board.id);
  res.json({ tasks });
});

app.post('/api/boards/:boardId/tasks', verifySameOrigin, requireAuth, requireOwnedBoard, (req, res, next) => {
  try {
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
    db.prepare(`
      INSERT INTO tasks (id, board_id, title, status, priority, due_date, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(task.id, req.board.id, task.title, task.status, task.priority, task.dueDate, task.createdAt);
    res.status(201).json({ task });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/boards/:boardId/tasks/:taskId', verifySameOrigin, requireAuth, requireOwnedBoard, (req, res, next) => {
  try {
    const status = req.body.status;
    if (!['todo', 'in-progress', 'done'].includes(status)) throw new HttpError(400, 'Unsupported task status');
    const result = db.prepare('UPDATE tasks SET status = ? WHERE id = ? AND board_id = ?')
      .run(status, req.params.taskId, req.board.id);
    if (!result.changes) throw new HttpError(404, 'Task not found');
    res.json({ id: req.params.taskId, status });
  } catch (error) {
    next(error);
  }
});

app.post('/api/account/import', verifySameOrigin, requireAuth, (req, res, next) => {
  try {
    const { boards, tasksByBoard } = req.body;
    if (!Array.isArray(boards) || boards.length === 0 || boards.length > 100
      || !tasksByBoard || typeof tasksByBoard !== 'object' || Array.isArray(tasksByBoard)) {
      throw new HttpError(400, 'Invalid import data');
    }
    const totalTasks = Object.values(tasksByBoard).reduce(
      (total, tasks) => total + (Array.isArray(tasks) ? tasks.length : 0), 0
    );
    if (totalTasks > 5000) throw new HttpError(400, 'Import is too large');

    const importData = db.transaction(() => {
      const user = db.prepare('SELECT legacy_imported FROM users WHERE id = ?').get(req.user.id);
      if (user.legacy_imported) throw new HttpError(409, 'Data has already been imported');
      const boardRows = boards.map((board, index) => {
        const name = requireValue(typeof board === 'string' ? board : board.name, 'Board name', 100);
        const oldId = typeof board === 'string' ? String(index) : String(board.id || index);
        return { oldId, id: crypto.randomUUID(), name, position: index };
      });

      db.prepare('DELETE FROM boards WHERE owner_id = ?').run(req.user.id);
      const addBoard = db.prepare(`
        INSERT INTO boards (id, owner_id, name, position, created_at) VALUES (?, ?, ?, ?, ?)
      `);
      const addTask = db.prepare(`
        INSERT INTO tasks (id, board_id, title, status, priority, due_date, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const board of boardRows) {
        addBoard.run(board.id, req.user.id, board.name, board.position, new Date().toISOString());
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
          addTask.run(crypto.randomUUID(), board.id, title, status, priority, dueDate, new Date().toISOString());
        }
      }
      db.prepare('UPDATE users SET legacy_imported = 1 WHERE id = ?').run(req.user.id);
      return boardRows.length;
    });

    res.json({ importedBoards: importData() });
  } catch (error) {
    next(error);
  }
});

app.use('/api', (req, res, next) => next(new HttpError(404, 'API endpoint not found')));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error instanceof HttpError ? error.status : Number(error.status) === 400 ? 400 : 500;
  if (status >= 500) console.error(error);
  res.status(status).json({ error: status >= 500 ? 'Unexpected server error' : error.message || 'Invalid request' });
});

app.listen(PORT, () => {
  console.log(`TaskFlow is listening on port ${PORT}`);
});
