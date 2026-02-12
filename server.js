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
