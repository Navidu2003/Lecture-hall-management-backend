<h1 align="center">Timelyx Backend ⚙️</h1>

<p align="center">
  <strong>The robust Express API powering the Timelyx Lecture Hall Management System.</strong>
</p>

<p align="center">
  <img alt="NodeJS" src="https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white"/>
  <img alt="Express.js" src="https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB"/>
  <img alt="MongoDB" src="https://img.shields.io/badge/MongoDB-%234ea94b.svg?style=for-the-badge&logo=mongodb&logoColor=white"/>
</p>

## 📖 Overview

Timelyx Backend provides a secure, scalable REST API for managing lecture halls, user authentication, and booking workflows. It is engineered with Express.js and backed by MongoDB, offering role-based access control and OAuth integrations.

## ✨ Features

- **Comprehensive Auth**: JWT-based authentication with password reset functionality and OAuth support (Google, Microsoft).
- **Role-Based Access Control**: Middleware to protect routes for Students, Technical Officers (TO), and HODs.
- **Resource Management**: Endpoints for CRUD operations on lecture halls, bookings, and notifications.
- **Automated Workflows**: Email notifications via Nodemailer and summary dashboard analytics.

## 🛠️ Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js v5
- **Database**: MongoDB with Mongoose v9
- **Security**: bcrypt & jsonwebtoken (JWT)

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) installed locally.
- A running instance of MongoDB (Local or Atlas).

### Installation

1. **Clone the repository**
2. **Install dependencies**
   ```bash
   npm install
   ```
3. **Configure Environment Variables**
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   Ensure the following essential variables are set:
   - `MONGODB_URI` / `MONGODB_URI_FALLBACK`
   - `JWT_SECRET`
   - `PORT` (e.g., 3000)
   - `FRONTEND_BASE_URL`
   - *OAuth credentials (`GOOGLE_CLIENT_ID`, `MICROSOFT_CLIENT_ID`, etc.)*

4. **Run the Application**
   - For development (with hot-reloading):
     ```bash
     npm run dev
     ```
   - For production:
     ```bash
     npm start
     ```

## 📂 API Architecture

- **`/users`**: Authentication, profile management, and OAuth callbacks.
- **`/halls`**: Lecture hall resource management.
- **`/bookings`**: Booking operations and scheduling logic.
- **`/notifications`**: System and user notifications.
- **`/dashboard`**: Data aggregation for analytics.

*Note: The `authenticateUser` middleware globally intercepts requests to parse and validate JWTs, securing sensitive routes.*

## 🧪 Demo Data

Populate your database with sample data by running:
```bash
npm run seed:demo
```
