# CompHub - Compensation Operations Task Management Hub

A fully functional, collaborative task management platform built specifically for compensation teams. Covers the entire annual compensation cycle with 228 pre-built task templates across 25 boards and 6 domains.

## Quick Start

```bash
git clone https://github.com/breakdwn094-stack/comp-task-hub.git
cd comp-task-hub
npm install
npm start
```

Open `http://localhost:3000` in your browser. Share the Network URL (printed in the terminal) with colleagues on the same network.

## What It Does

CompHub is a Monday.com-style project management tool purpose-built for compensation operations. It comes pre-loaded with task templates covering every major compensation workstream a team of 5-10 FTEs would encounter in a year.

### Domains Covered

- **Base Pay & Structures** -- Salary structure review, market pricing, merit cycle, pay equity, job architecture
- **Variable Pay & Incentives** -- Annual incentive plans, sales comp, equity/LTI, recognition, retention
- **Executive Compensation** -- Executive comp cycle, proxy/CD&A, committee governance, director comp, exec benefits
- **Global / International** -- Global pay structures, mobility/expat comp, international compliance
- **Compliance & Governance** -- Regulatory compliance, pay transparency, compensation governance
- **Operations & Administration** -- Survey management, HRIS/tech, budget planning, stakeholder management

### Features

- **Dashboard** with real-time metrics, domain progress, monthly volume charts, and upcoming deadlines
- **Table view** with search, status/priority/owner filters
- **Kanban board** view for visual task management
- **Annual calendar** showing task distribution across all 12 months
- **Template library** with all 25 boards organized by domain
- **Full CRUD** -- create, edit, and delete tasks with persistent storage
- **Multi-user collaboration** -- shared board with 5-second polling sync
- **Editable task properties** -- status, owner, priority, due date, notes
- **Data persistence** -- all changes saved to `data/tasks.json`
- **Reset to templates** -- one-click reset to regenerate all 228 default tasks

## Tech Stack

- **Backend:** Node.js + Express
- **Frontend:** React 18 (CDN-loaded with Babel standalone)
- **Charts:** Recharts
- **Styling:** Tailwind CSS
- **Storage:** JSON file (no database required)
- **Dependencies:** Express only (single npm dependency)

## Project Structure

```
comp-task-hub/
  package.json          # Project config (single dependency: express)
  server.js             # Express REST API + JSON file persistence
  templates.js          # 25 boards, 228 task template definitions
  public/
    index.html          # React frontend (self-contained, CDN-loaded)
  data/
    tasks.json          # Auto-created on first run, persists all changes
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | Retrieve all tasks |
| POST | `/api/tasks` | Create a new task |
| PUT | `/api/tasks/:id` | Update a task (partial update) |
| DELETE | `/api/tasks/:id` | Delete a task |
| POST | `/api/seed` | Reset and re-seed all tasks from templates |
| GET | `/api/config` | Get board and domain configuration |

## Configuration

- **Port:** Defaults to 3000. Override with `PORT=8080 npm start`
- **Data location:** `data/tasks.json` (auto-created on first run)
- **Network access:** Listens on `0.0.0.0` so colleagues can connect via your IP

## Requirements

- Node.js v16 or higher
- npm (comes with Node.js)
