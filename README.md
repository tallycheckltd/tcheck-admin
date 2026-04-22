# TCheck - Student Attendance Management System

TCheck is a full-stack student attendance management platform that uses **BLE beacon proximity detection** and **QR code scanning** for automated class check-ins. It consists of three components: a Node.js API server, a React admin/lecturer dashboard, and a native iOS student app.

---

## Architecture Overview

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   iOS Student App   │     │   React Dashboard   │     │   PostgreSQL DB     │
│   (SwiftUI + BLE)   │────▶│  (Vite + Tailwind)  │────▶│  (Docker / Port     │
│   Port: Simulator   │     │  Port: 5173         │     │   5433)             │
└────────┬────────────┘     └────────┬────────────┘     └─────────────────────┘
         │                           │                            ▲
         │        ┌──────────────────┘                            │
         │        │                                               │
         ▼        ▼                                               │
    ┌─────────────────────────────────┐                           │
    │      Express API Server         │                           │
    │  (Node.js + Prisma + Socket.io) │───────────────────────────┘
    │      Port: 3001                 │
    └─────────────────────────────────┘
```

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| **Backend** | Node.js, Express, TypeScript, Prisma ORM, Socket.io |
| **Database** | PostgreSQL 16 (via Docker) |
| **Dashboard** | React 19, TypeScript, Vite, Tailwind CSS, Recharts, TanStack Table |
| **iOS App** | SwiftUI, CoreBluetooth, CoreLocation, MVVM |
| **Auth** | JWT (access + refresh tokens), bcrypt password hashing |
| **Validation** | Zod schemas |
| **Real-time** | Socket.io (attendance updates, messaging, notifications) |

---

## Prerequisites

- **Node.js** >= 18
- **Docker** & Docker Compose
- **Xcode** >= 15 (for the iOS app)
- **npm** (comes with Node.js)

---

## Getting Started

### 1. Start the Database

```bash
cd tcheck-app
docker compose up -d
```

This starts a PostgreSQL container on **port 5433** with:
- User: `tcheck`
- Password: `tcheck_dev_password`
- Database: `tcheck`

### 2. Set Up the Server

```bash
cd server
npm install
```

Create a `.env` file (or use the existing one):

```env
DATABASE_URL="postgresql://tcheck:tcheck_dev_password@localhost:5433/tcheck?schema=public"
JWT_SECRET="tcheck-jwt-secret-change-in-production"
JWT_REFRESH_SECRET="tcheck-refresh-secret-change-in-production"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
PORT=3001
CLIENT_URL="http://localhost:5173"
```

Push the schema and seed the database:

```bash
npm run db:push
npm run db:generate
npm run db:seed
```

Start the development server:

```bash
npm run dev
```

The API runs at **http://localhost:3001**. Verify with:

```bash
curl http://localhost:3001/api/health
```

### 3. Start the Dashboard

```bash
cd dashboard
npm install
npm run dev
```

The dashboard runs at **http://localhost:5173**.

### 4. Run the iOS App

1. Open `StudentAttendance/StudentAttendance.xcodeproj` in Xcode
2. The app auto-detects the environment:
   - **Simulator** → connects to `http://localhost:3001/api`
   - **Physical device** → connects to your Mac's local IP on port 3001
3. Select a simulator or device and press **Cmd + R**

> **Note:** If running on a physical device, update the IP in `StudentAttendance/Config/AppConfig.swift` to match your Mac's current local IP address.

---

## Test Credentials

All accounts use the password: **`password123`**

### Admin
| Email | Role | School |
|---|---|---|
| admin@tcheck.app | SUPER_ADMIN | Daystar University |

### Lecturers
| Email | Name | School |
|---|---|---|
| lecturer1@tcheck.app | John Kamau | Daystar University |
| lecturer2@tcheck.app | Mary Wanjiku | Strathmore University |

### Students
| Email | Name | Student ID | School |
|---|---|---|---|
| student1@tcheck.app | Brian Ochieng | STU001 | Daystar University |
| student2@tcheck.app | Faith Muthoni | STU002 | Daystar University |
| student3@tcheck.app | Kevin Njoroge | STU003 | Strathmore University |
| student4@tcheck.app | Grace Akinyi | STU004 | Strathmore University |
| student5@tcheck.app | Daniel Kiprop | STU005 | Test School |

### Schools
| Name | Code |
|---|---|
| Daystar University | DAY |
| Strathmore University | STR |
| Test School | TST |

---

## Key Features

### Attendance Check-in Methods
- **BLE Beacon** — The iOS app detects classroom beacons via Bluetooth Low Energy. Check-in is validated against the beacon UUID, signal strength (RSSI threshold), and enrollment.
- **QR Code** — Lecturers generate time-limited QR codes from the dashboard. Students scan with the iOS app camera.
- **Manual** — Lecturers and admins can manually mark students present from the dashboard.

### Role-Based Access
| Role | Access |
|---|---|
| **SUPER_ADMIN** | Full platform access — schools, users, settings, all courses, all messages |
| **SUB_ADMIN** | School-level admin — users, courses, beacons, attendance, flagged messages |
| **LECTURER** | Own courses — create classes, monitor attendance, generate QR codes, messaging |
| **STUDENT** | Mobile app — view classes, check in, view attendance analytics, messaging |

### Real-Time Updates (Socket.io)
- Live attendance tracking when students check in
- New class notifications pushed to enrolled students
- Messaging with typing indicators and read receipts
- Moderation alerts for flagged messages

### Dashboard Pages

**Admin:**
- Overview dashboard with attendance stats
- User management (approve/reject, create, delete)
- School and course management
- BLE beacon management
- Attendance analytics with charts
- Message moderation and flagged content

**Lecturer:**
- Personal dashboard
- Class session creation and management
- Live attendance monitoring
- QR code generation
- Attendance reports
- Student messaging

### iOS App Screens
- School selection and login/signup
- Home — today's classes (ongoing, upcoming, completed)
- Check-in sheet — BLE beacon detection or QR scan
- Courses — enrolled courses and details
- Chat — messaging with lecturers
- Profile — student info and exam card

---

## API Endpoints

| Group | Endpoint | Description |
|---|---|---|
| **Auth** | `POST /api/auth/signup` | Register |
| | `POST /api/auth/login` | Login |
| | `POST /api/auth/refresh` | Refresh token |
| | `GET /api/auth/me` | Current user |
| **Schools** | `GET /api/schools` | List schools |
| | `POST /api/schools` | Create school |
| **Users** | `GET /api/users` | List users |
| | `PATCH /api/users/:id/status` | Approve/reject user |
| **Courses** | `GET /api/courses` | List courses |
| | `GET /api/courses/my` | My courses |
| | `POST /api/courses/enroll` | Enroll student |
| **Classes** | `GET /api/classes/today` | Today's classes |
| | `POST /api/classes` | Create class session |
| **Attendance** | `POST /api/attendance/check-in` | BLE check-in |
| | `POST /api/attendance/qr-check-in` | QR check-in |
| | `POST /api/attendance/check-out` | Check out |
| | `POST /api/attendance/qr-code/:classId` | Generate QR |
| | `GET /api/attendance/analytics` | Attendance stats |
| | `GET /api/attendance/exam-card` | Exam eligibility card |
| **Beacons** | `GET /api/beacons` | List beacons |
| | `POST /api/beacons` | Register beacon |
| **Messages** | `GET /api/messages/conversations` | List conversations |
| | `POST /api/messages/send` | Send message |
| | `POST /api/messages/flag` | Flag message |
| **Notifications** | `GET /api/notifications` | List notifications |
| | `GET /api/notifications/unread-count` | Unread count |
| **Health** | `GET /api/health` | API status |

---

## Project Structure

```
tcheck-app/
├── server/                         # Backend API
│   ├── src/
│   │   ├── config/                # Database & app config
│   │   ├── controllers/           # Route handlers
│   │   ├── middleware/            # Auth, validation, error handling
│   │   ├── routes/                # Express routers
│   │   ├── services/              # Business logic
│   │   ├── validators/            # Zod schemas
│   │   ├── socket/                # Socket.io events
│   │   ├── utils/                 # JWT helpers, error classes
│   │   └── index.ts               # App entry point
│   ├── prisma/
│   │   ├── schema.prisma          # Database schema
│   │   └── seed.ts                # Test data seeder
│   ├── .env                       # Environment variables
│   └── package.json
│
├── dashboard/                      # React admin/lecturer UI
│   ├── src/
│   │   ├── pages/
│   │   │   ├── admin/             # Admin-only pages
│   │   │   ├── lecturer/          # Lecturer pages
│   │   │   └── LoginPage.tsx
│   │   ├── components/ui/         # Reusable UI components
│   │   ├── context/               # Auth & Theme providers
│   │   ├── hooks/                 # useApi, useMutation, useSocket
│   │   └── App.tsx                # Router & layout
│   └── package.json
│
├── StudentAttendance/              # iOS student app
│   ├── StudentAttendance/
│   │   ├── Config/                # API base URL config
│   │   ├── Managers/              # BLEManager, BeaconManager
│   │   ├── Models/                # Codable API models
│   │   ├── Services/              # APIClient, KeychainService
│   │   ├── ViewModels/            # MVVM view models
│   │   ├── Views/                 # SwiftUI screens
│   │   │   ├── App/               # ContentView, MainTabView
│   │   │   ├── Auth/              # Login, Signup, School selection
│   │   │   ├── Home/              # Classes, Check-in, QR scanner
│   │   │   ├── Courses/           # Course list & details
│   │   │   ├── Chat/              # Messaging
│   │   │   └── Profile/           # Student profile
│   │   ├── Theme/                 # Colors, typography, components
│   │   └── Info.plist             # iOS permissions
│   └── StudentAttendance.xcodeproj
│
├── docker-compose.yml              # PostgreSQL container
├── CREDENTIALS.md                  # Test account credentials
└── README.md
```

---

## iOS Permissions

The iOS app requires the following permissions (configured in `Info.plist`):

| Permission | Reason |
|---|---|
| Bluetooth (Always) | Detect classroom BLE beacons for attendance |
| Location (When In Use) | Required for iBeacon ranging |
| Camera | Scan QR codes for check-in |
| Local Networking | Communicate with local API server |

---

## Useful Commands

```bash
# Database
npm run db:studio        # Open Prisma Studio GUI (visual DB browser)
npm run db:migrate       # Create and run migrations
npm run db:push          # Sync schema without migrations
npm run db:seed          # Re-seed test data

# Server
npm run dev              # Start with auto-reload
npm run build            # Compile TypeScript
npm run start            # Run compiled JS

# Dashboard
npm run dev              # Start Vite dev server
npm run build            # Production build
npm run preview          # Preview production build

# Docker
docker compose up -d     # Start PostgreSQL
docker compose down      # Stop PostgreSQL
docker compose down -v   # Stop and delete data
```
