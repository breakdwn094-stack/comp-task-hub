// ═══════════════════════════════════════════════════════════════════════
// CompHub Server - Express REST API with JSON File Persistence
// ═══════════════════════════════════════════════════════════════════════
const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { DOMAIN_META, BOARDS } = require('./templates');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const ACTIVITY_FILE = path.join(DATA_DIR, 'activity.json');

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Data Persistence Helpers ─────────────────────────────────────────

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readTasks() {
  ensureDataDir();
  if (!fs.existsSync(TASKS_FILE)) return null;
  try {
    const raw = fs.readFileSync(TASKS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading tasks file:', err.message);
    return null;
  }
}

let writeTimeout = null;
function writeTasks(tasks) {
  ensureDataDir();
  // Debounced write to avoid excessive disk I/O under rapid updates
  clearTimeout(writeTimeout);
  // Write immediately for data safety, but debounce subsequent writes
  try {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
  } catch (err) {
    console.error('Error writing tasks file:', err.message);
  }
}

// ── Activity/Comments Persistence ────────────────────────────────────

function readActivity() {
  ensureDataDir();
  if (!fs.existsSync(ACTIVITY_FILE)) return {};
  try {
    const raw = fs.readFileSync(ACTIVITY_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading activity file:', err.message);
    return {};
  }
}

function writeActivity(activity) {
  ensureDataDir();
  try {
    fs.writeFileSync(ACTIVITY_FILE, JSON.stringify(activity, null, 2));
  } catch (err) {
    console.error('Error writing activity file:', err.message);
  }
}

function addActivityEntry(taskId, entry) {
  const activity = readActivity();
  const key = String(taskId);
  if (!activity[key]) activity[key] = [];
  activity[key].push({
    id: Date.now() + Math.random(),
    ...entry,
    timestamp: new Date().toISOString()
  });
  writeActivity(activity);
  return activity[key];
}

// ── Seed Function ────────────────────────────────────────────────────

function seedTasks() {
  const now = new Date();
  const year = now.getFullYear();
  let id = 1;
  const tasks = [];

  BOARDS.forEach(board => {
    board.tasks.forEach(tmpl => {
      // Spread due dates across the month (5th to 25th)
      const day = 5 + Math.floor(Math.random() * 20);
      const dueMonth = tmpl.m; // 1-indexed month
      const dueDate = new Date(year, dueMonth - 1, day);

      tasks.push({
        id: id++,
        title: tmpl.t,
        month: tmpl.m,
        duration: tmpl.d || "1 week",
        owner: tmpl.o,
        priority: tmpl.p,
        status: "not_started",
        dueDate: dueDate.toISOString().split('T')[0], // YYYY-MM-DD
        boardId: board.id,
        boardName: board.name,
        domainId: board.domain,
        domainName: DOMAIN_META[board.domain].name,
        notes: "",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      });
    });
  });

  writeTasks(tasks);
  return tasks;
}

// ── API Routes ───────────────────────────────────────────────────────

// GET /api/tasks - Retrieve all tasks
app.get('/api/tasks', (req, res) => {
  let tasks = readTasks();
  if (!tasks) {
    console.log('No data file found. Seeding with templates...');
    tasks = seedTasks();
    console.log(`Seeded ${tasks.length} tasks across ${BOARDS.length} boards.`);
  }
  res.json(tasks);
});

// POST /api/tasks - Create a new task
app.post('/api/tasks', (req, res) => {
  const tasks = readTasks() || [];
  const maxId = tasks.reduce((max, t) => Math.max(max, t.id), 0);
  const now = new Date().toISOString();
  const body = req.body;

  const newTask = {
    id: maxId + 1,
    title: body.title || "New Task",
    month: body.month || (new Date().getMonth() + 1),
    duration: body.duration || "1 week",
    owner: body.owner || "Analyst",
    priority: body.priority || "medium",
    status: body.status || "not_started",
    dueDate: body.dueDate || new Date().toISOString().split('T')[0],
    boardId: body.boardId || "",
    boardName: body.boardName || "",
    domainId: body.domainId || "",
    domainName: body.domainName || "",
    notes: body.notes || "",
    createdAt: now,
    updatedAt: now
  };

  tasks.push(newTask);
  writeTasks(tasks);
  res.status(201).json(newTask);
});

// PUT /api/tasks/:id - Update an existing task (partial update)
app.put('/api/tasks/:id', (req, res) => {
  const tasks = readTasks() || [];
  const id = parseInt(req.params.id);
  const idx = tasks.findIndex(t => t.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: "Task not found" });
  }

  const oldTask = { ...tasks[idx] };

  // Merge updates, preserve id and createdAt
  const updated = {
    ...tasks[idx],
    ...req.body,
    id: id,
    createdAt: tasks[idx].createdAt,
    updatedAt: new Date().toISOString()
  };

  tasks[idx] = updated;
  writeTasks(tasks);

  // Auto-log activity for tracked field changes
  const trackedFields = ['status', 'owner', 'priority', 'dueDate', 'title'];
  trackedFields.forEach(field => {
    if (req.body[field] !== undefined && req.body[field] !== oldTask[field]) {
      addActivityEntry(id, {
        type: 'field_change',
        field: field,
        oldValue: oldTask[field],
        newValue: req.body[field],
        actor: req.body._actor || 'User'
      });
    }
  });

  res.json(updated);
});

// DELETE /api/tasks/:id - Delete a task
app.delete('/api/tasks/:id', (req, res) => {
  const tasks = readTasks() || [];
  const id = parseInt(req.params.id);
  const idx = tasks.findIndex(t => t.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: "Task not found" });
  }

  tasks.splice(idx, 1);
  writeTasks(tasks);
  res.status(204).send();
});

// POST /api/seed - Reset and re-seed all tasks from templates
app.post('/api/seed', (req, res) => {
  const tasks = seedTasks();
  // Also reset activity data
  writeActivity({});
  res.json({
    message: `Database reset. Seeded ${tasks.length} tasks across ${BOARDS.length} boards.`,
    count: tasks.length,
    boards: BOARDS.length
  });
});

// GET /api/config - Return board and domain configuration
app.get('/api/config', (req, res) => {
  res.json({
    domains: DOMAIN_META,
    boards: BOARDS.map(b => ({
      id: b.id,
      name: b.name,
      domain: b.domain,
      cadence: b.cadence,
      desc: b.desc,
      taskCount: b.tasks.length
    })),
    totalTemplates: BOARDS.reduce((sum, b) => sum + b.tasks.length, 0)
  });
});

// ── Comments & Activity Routes ────────────────────────────────────────

// GET /api/tasks/:id/activity - Get all activity for a task (comments + changes)
app.get('/api/tasks/:id/activity', (req, res) => {
  const id = req.params.id;
  const activity = readActivity();
  const entries = activity[id] || [];
  res.json(entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
});

// POST /api/tasks/:id/comments - Add a comment to a task
app.post('/api/tasks/:id/comments', (req, res) => {
  const id = parseInt(req.params.id);
  const tasks = readTasks() || [];
  const task = tasks.find(t => t.id === id);

  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }

  const entry = {
    type: 'comment',
    author: req.body.author || 'User',
    text: req.body.text || '',
    actor: req.body.author || 'User'
  };

  const entries = addActivityEntry(id, entry);
  res.status(201).json(entries[entries.length - 1]);
});

// GET /api/people - Return team member roles with avatar colors
app.get('/api/people', (req, res) => {
  res.json([
    { id: 'director', name: 'Director', initials: 'DR', color: '#7B68EE' },
    { id: 'manager', name: 'Manager', initials: 'MG', color: '#FF6B6B' },
    { id: 'lead', name: 'Lead', initials: 'LD', color: '#4ECDC4' },
    { id: 'sr-analyst', name: 'Sr Analyst', initials: 'SA', color: '#45B7D1' },
    { id: 'analyst', name: 'Analyst', initials: 'AN', color: '#96CEB4' },
    { id: 'admin', name: 'Admin', initials: 'AD', color: '#FFEAA7' },
    { id: 'legal', name: 'Legal', initials: 'LG', color: '#DDA0DD' },
    { id: 'finance', name: 'Finance', initials: 'FN', color: '#98D8C8' },
  ]);
});

// Catch-all: serve index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Server Startup ───────────────────────────────────────────────────

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

app.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log('');
  console.log('  CompHub - Compensation Operations Hub');
  console.log('  ======================================');
  console.log(`  Local:     http://localhost:${PORT}`);
  console.log(`  Network:   http://${localIP}:${PORT}`);
  console.log('');
  console.log('  Share the Network URL with colleagues on your network.');
  console.log('');

  let tasks = readTasks();
  if (!tasks) {
    console.log('  First run detected. Seeding with 228 template tasks...');
    tasks = seedTasks();
    console.log(`  Done! ${tasks.length} tasks across ${BOARDS.length} boards created.`);
  } else {
    console.log(`  Loaded ${tasks.length} tasks from data/tasks.json`);
  }
  console.log('');
});
