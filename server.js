const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const db = require('./models/db');
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const uploadRoutes = require('./routes/upload');
const socketHandler = require('./socket/socket');

const app = express();
const server = http.createServer(app);

// Configure Port
const PORT = process.env.PORT || 5001;

// CORS setup
const corsOptions = {
  origin: '*', // For testing convenience, we support any client connection origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Express request logger for diagnostics
app.use((req, res, next) => {
  console.log(`[API REQUEST] ${req.method} ${req.url}`);
  next();
});

// Serve Static Uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/upload', uploadRoutes);

// Health Check / Diagnostics
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    dbConnected: db.isConnected(),
    mode: db.isConnected() ? 'MongoDB' : 'In-Memory Fallback'
  });
});

// Configure Socket.io server
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Initialize Socket.io handling
socketHandler(io);

// Connect Database & Start Server
const startServer = async () => {
  console.log('⚡ Starting Horizon RTC Server...');
  
  // Try connecting to MongoDB (falls back to memory if connection details are missing or fail)
  await db.connectDb();
  
  server.listen(PORT, '0.0.0.0', () => {
    console.log('\n=========================================');
    console.log(`🚀 Server successfully running on port ${PORT}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
    console.log(`🛠️  Execution Mode: ${db.isConnected() ? 'MongoDB Cloud Atlas' : 'Local Secure Memory'}`);
    console.log('=========================================\n');
  });
};

startServer();
