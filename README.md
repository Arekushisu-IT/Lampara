# LAMPARA Admin Panel - Backend API

**Project:** STI College BSIT Capstone 2026  
**Version:** 1.0.0  
**Backend Technology:** Node.js + Express.js  
**Database:** MySQL  
**API Standard:** RESTful

---

## Quick Start

### Prerequisites
- Node.js (v14 or higher)
- MySQL Server (local or cloud instance)
- npm (comes with Node.js)

### 1. Initial Setup

```bash
# Clone/navigate to Lampara-Backend directory
cd Lampara-Backend

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit .env with your database credentials
# Important: Change DB_PASSWORD and JWT_SECRET
```

### 2. Database Setup

#### Option A: Local MySQL
```bash
# Login to MySQL
mysql -u root -p

# Run the schema
SOURCE database.sql;

# Verify (should see tables)
SHOW TABLES;
```

#### Option B: Cloud Database (Recommended for Production)
Supported platforms:
- **Railway.app** (recommended for Node.js + MySQL)
- **Render.com**
- **Heroku** (paid plans)
- **PlanetScale** (free MySQL tier)
- **AWS RDS**
- **DigitalOcean**

For cloud databases:
1. Create MySQL instance on your chosen platform
2. Get connection URL
3. Update `DATABASE_URL` in `.env`

### 3. Start the Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server should start on `http://localhost:5000`

---

## API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication
All endpoints except `/auth/login` and `/auth/register` require JWT token:
```
Authorization: Bearer <token>
```

---

## 📍 Endpoints

### Auth Endpoints

#### Register New User
```
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "name": "User Name"
}

Response (201):
{
  "message": "User registered successfully",
  "userId": 1
}
```

#### Login
```
POST /auth/login
Content-Type: application/json

{
  "email": "admin@lampara.edu.ph",
  "password": "SuperAdmin2026!"
}

Response (200):
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "email": "admin@lampara.edu.ph",
    "name": "Admin User",
    "role": "admin"
  }
}
```

#### Get Current User
```
GET /auth/me
Authorization: Bearer <token>

Response (200):
{
  "user": {
    "id": 1,
    "email": "admin@lampara.edu.ph",
    "name": "Admin User",
    "role": "admin"
  }
}
```

---

### Players Endpoints

#### Get All Players
```
GET /players
Authorization: Bearer <token>

Response (200):
{
  "count": 3,
  "players": [
    {
      "id": 1,
      "name": "Demo Player 1",
      "email": "player1@lampara.edu.ph",
      "level": 5,
      "experience": 1500,
      "status": "active",
      "created_at": "2026-03-17T10:30:00Z"
    }
  ]
}
```

#### Get Player by ID
```
GET /players/:id
Authorization: Bearer <token>

Response (200):
{
  "player": {
    "id": 1,
    "name": "Demo Player 1",
    "email": "player1@lampara.edu.ph",
    "level": 5,
    "experience": 1500,
    "status": "active",
    "created_at": "2026-03-17T10:30:00Z"
  }
}
```

#### Create New Player
```
POST /players
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "New Player",
  "email": "newplayer@example.com",
  "level": 1,
  "experience": 0,
  "status": "active"
}

Response (201):
{
  "message": "Player created successfully",
  "playerId": 4
}
```

#### Update Player
```
PUT /players/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "level": 6,
  "experience": 2000,
  "status": "active"
}

Response (200):
{
  "message": "Player updated successfully"
}
```

#### Delete Player
```
DELETE /players/:id
Authorization: Bearer <token>

Response (200):
{
  "message": "Player deleted successfully"
}
```

---

### Quests Endpoints

#### Get All Quests
```
GET /quests
Authorization: Bearer <token>

Response (200):
{
  "count": 5,
  "quests": [
    {
      "id": 1,
      "chapter": 1,
      "title": "Chapter 1 Quest 1",
      "description": "Complete the first quest",
      "status": "active",
      "created_at": "2026-03-17T10:30:00Z"
    }
  ]
}
```

#### Get Quests by Chapter
```
GET /quests/chapter/:chapter
Authorization: Bearer <token>

Response (200):
{
  "chapter": "1",
  "count": 2,
  "quests": [...]
}
```

#### Get Quest by ID
```
GET /quests/:id
Authorization: Bearer <token>

Response (200):
{
  "quest": {
    "id": 1,
    "chapter": 1,
    "title": "Chapter 1 Quest 1",
    "description": "Complete the first quest",
    "status": "active",
    "created_at": "2026-03-17T10:30:00Z"
  }
}
```

#### Create Quest
```
POST /quests
Authorization: Bearer <token>
Content-Type: application/json

{
  "chapter": 1,
  "title": "New Quest",
  "description": "Quest description",
  "status": "active"
}

Response (201):
{
  "message": "Quest created successfully",
  "questId": 6
}
```

#### Update Quest
```
PUT /quests/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated Title",
  "status": "inactive"
}

Response (200):
{
  "message": "Quest updated successfully"
}
```

#### Delete Quest
```
DELETE /quests/:id
Authorization: Bearer <token>

Response (200):
{
  "message": "Quest deleted successfully"
}
```

---

### Activity Logs Endpoints

#### Get All Logs
```
GET /logs?limit=100&offset=0
Authorization: Bearer <token>

Response (200):
{
  "count": 5,
  "total": 5,
  "logs": [
    {
      "id": 1,
      "user_id": 1,
      "action": "login",
      "description": "Admin logged in",
      "timestamp": "2026-03-17T10:30:00Z"
    }
  ]
}
```

#### Get User's Logs
```
GET /logs/user/:userId?limit=50&offset=0
Authorization: Bearer <token>

Response (200):
{
  "userId": "1",
  "count": 3,
  "logs": [...]
}
```

#### Create Log Entry
```
POST /logs
Authorization: Bearer <token>
Content-Type: application/json

{
  "action": "quest_completed",
  "description": "Player completed Chapter 1 Quest 1"
}

Response (201):
{
  "message": "Log created successfully",
  "logId": 10
}
```

#### Get Logs by Action
```
GET /logs/action/:action?limit=50&offset=0
Authorization: Bearer <token>

Response (200):
{
  "action": "login",
  "count": 5,
  "logs": [...]
}
```

---

## Health Check

### Server Status
```
GET /api/health

Response (200):
{
  "status": "online",
  "message": "LAMPARA Backend is running",
  "timestamp": "2026-03-17T10:30:00Z"
}
```

---

## Environment Variables

Create `.env` file from `.env.example`:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=lampara_user
DB_PASSWORD=YourPassword123!
DB_NAME=lampara_database

# JWT Configuration
JWT_SECRET=your_secret_key_change_this_production
JWT_EXPIRATION=7d

# Server
PORT=5000
NODE_ENV=development

# CORS (Frontend URLs)
FRONTEND_URL=http://localhost:3000
FRONTEND_URL_PROD=https://yourdomain.com

# Cloud Database URL (for services like Railway, Render)
DATABASE_URL=mysql://user:pass@host:port/db_name
```

---

## Cloud Deployment

### Railway.app (Recommended)

1. Create account at railway.app
2. Create new project
3. Add MySQL plugin
4. Add Node.js service from GitHub
5. Set environment variables in Railway dashboard
6. Deploy

### Render.com

1. Create account at render.com
2. Create new Web Service
3. Add MySQL database
4. Connect GitHub repository
5. Set environment variables
6. Deploy

### Connecting Frontend to Backend

Update your frontend JavaScript to use the backend API:

```javascript
// Replace hardcoded data with API calls
const API_URL = 'https://your-backend-url/api';

async function login(email, password) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return await response.json();
}

async function getPlayers(token) {
  const response = await fetch(`${API_URL}/players`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return await response.json();
}
```

---

## Demo Credentials

**Admin Account:**
- Email: `admin@lampara.edu.ph`
- Password: `SuperAdmin2026!`

---

## Troubleshooting

### Database Connection Error
- Check MySQL is running
- Verify credentials in `.env`
- Check database exists: `SHOW DATABASES;`

### CORS Error
- Update `FRONTEND_URL` in `.env`
- Restart server

### Port Already in Use
- Change `PORT` in `.env`
- Or kill process: `lsof -i :5000` (macOS/Linux)

---

## Project Structure

```
Lampara-Backend/
├── server.js           # Main server file
├── db.js               # Database connection
├── package.json        # Dependencies
├── .env.example        # Environment template
├── database.sql        # Database schema
├── README.md           # This file
└── routes/
    ├── auth.js         # Authentication
    ├── players.js      # Player management
    ├── quests.js       # Quest management
    └── logs.js         # Activity logging
```

---

## Next Steps

1. ✅ Backend infrastructure set up
2. 📝 Update frontend to use API endpoints
3. 🔓 Replace hardcoded accounts with database
4. 🎮 Plan Unity integration
5. 🚀 Deploy to cloud

---

**Questions?** Review the API documentation above or check Express.js documentation.
