# Exam Duty Allocation and Management

Full-stack app for exam duty allocation with React (Vite) frontend and Node/Express backend.

## Requirements

- Node.js 20.17.0 or newer
- npm 10+
- MySQL 8+

## Setup

1. Install dependencies:
   npm install

2. Create local environment file:
   - Copy `.env.example` to `.env`
   - Update DB credentials in `.env`

3. Create database schema:
   - Use `server/db/schema.sql` to create tables in MySQL

## Run (Development)

- Backend only:
  npm run server

- Frontend only:
  npm run dev -- --host 127.0.0.1 --port 5173

- Both together:
  npm run dev-full

## URLs

- Frontend: http://127.0.0.1:5173
- Backend: http://127.0.0.1:3001
- Health: http://127.0.0.1:3001/api/health

## Login

- Username: `admin`
- Password: `admin123`

