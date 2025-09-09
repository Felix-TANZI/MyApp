// backend/src/server.js
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const http = require('http');
const socketIo = require('socket.io');
const notificationService = require('./services/notificationService');
require('dotenv').config();

// Import des routes
const authRoutes = require('./routes/auth');
const clientsRoutes = require('./routes/clients');
const invoicesRoutes = require('./routes/invoices');
const usersRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 5000;

// Créer le serveur HTTP
const server = http.createServer(app);

// Configuration Socket.io avec CORS
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  },
  // Configuration pour la production
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Initialiser le service de notifications
notificationService.initialize(io);

// Configuration CORS pour Express
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logger amélioré
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.url}`);
  next();
});

// Middleware pour ajouter le service de notifications aux requêtes
app.use((req, res, next) => {
  req.notificationService = notificationService;
  next();
});

// Test de connexion MySQL
async function testDB() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER, 
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    console.log('✅ Connexion MySQL réussie');
    console.log(`📡 Host: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
    console.log(`🗄️  Base: ${process.env.DB_NAME}`);
    await connection.end();
    return true;
  } catch (error) {
    console.error('❌ Erreur MySQL:', error.message);
    return false;
  }
}

// Routes principales
app.get('/', (req, res) => {
  const stats = notificationService.getConnectionStats();
  
  res.json({
    message: 'API Amani - Système de Gestion des Factures avec Notifications Temps Réel',
    version: '2.0.0',
    notifications: {
      service: 'active',
      connectedUsers: stats.connectedUsers,
      connectedClients: stats.connectedClients,
      totalSockets: stats.totalSockets
    },
    endpoints: [
      'GET /',
      'GET /api/health',
      
      // Auth endpoints
      'POST /api/auth/login/professional',
      'POST /api/auth/login/client',
      'POST /api/auth/logout',
      'GET /api/auth/profile',
      'GET /api/auth/verify',
      
      // Users endpoints 
      'GET /api/users',
      'GET /api/users/stats',
      'GET /api/users/:id',
      'POST /api/users',
      'PUT /api/users/:id',
      'PUT /api/users/:id/role',
      'PUT /api/users/:id/password',
      'POST /api/users/:id/toggle-status',
      'DELETE /api/users/:id',
      
      // Clients endpoints
      'GET /api/clients',
      'GET /api/clients/stats',
      'GET /api/clients/:id',
      'POST /api/clients',
      'PUT /api/clients/:id',
      'DELETE /api/clients/:id',
      'POST /api/clients/:id/toggle-status',
      
      // Invoices endpoints
      'GET /api/invoices',
      'GET /api/invoices/stats',
      'GET /api/invoices/:id',
      'GET /api/invoices/:id/pdf',
      'POST /api/invoices',
      'POST /api/invoices/:id/duplicate',
      'POST /api/invoices/:id/status',
      'PUT /api/invoices/:id',
      'DELETE /api/invoices/:id',
      
      // Notifications endpoints
      'GET /api/notifications',
      'POST /api/notifications/send',
      'PUT /api/notifications/:id/read',
      'DELETE /api/notifications/:id',
      'DELETE /api/notifications/clear-all',
      'GET /api/notifications/stats'
    ],
    websocket: {
      endpoint: '/socket.io/',
      events: [
        'connection',
        'new_notification',
        'unread_notifications',
        'notifications_list',
        'mark_notification_read',
        'notification_deleted',
        'ping/pong'
      ]
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', async (req, res) => {
  const dbOk = await testDB();
  const stats = notificationService.getConnectionStats();
  
  res.json({
    status: 'OK',
    database: dbOk ? 'Connected' : 'Error',
    notifications: {
      service: 'running',
      connections: stats
    },
    timestamp: new Date().toISOString()
  });
});

// Routes d'authentification
app.use('/api/auth', authRoutes);

// Routes de gestion des utilisateurs
app.use('/api/users', usersRoutes);

// Routes de gestion des clients
app.use('/api/clients', clientsRoutes);

// Routes de gestion des factures
app.use('/api/invoices', invoicesRoutes);

// Routes client
app.use('/api/client', require('./routes/client'));

// Routes admin pour les demandes
app.use('/api/requests', require('./routes/requests'));

// Routes notifications
app.use('/api/notifications', require('./routes/notifications'));

// Route 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route non trouvée: ${req.method} ${req.originalUrl}`,
    availableEndpoints: [
      'GET /',
      'GET /api/health',
      'POST /api/auth/login/professional',
      'POST /api/auth/login/client',
      'WebSocket /socket.io/'
    ]
  });
});

// Gestion erreurs globales
app.use((error, req, res, next) => {
  console.error('❌ Erreur serveur:', error);
  
  // Erreur de validation JSON
  if (error instanceof SyntaxError && error.status === 400) {
    return res.status(400).json({
      success: false,
      message: 'Format JSON invalide'
    });
  }
  
  res.status(500).json({
    success: false,
    message: 'Erreur interne du serveur',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// Démarrage serveur
async function startServer() {
  try {
    // Test base de données
    const dbConnected = await testDB();
    
    if (!dbConnected) {
      console.error('❌ Impossible de se connecter à la base de données');
      process.exit(1);
    }
    
    // Démarrer le serveur HTTP avec Socket.io
    server.listen(PORT, () => {
      console.log('\n🎉================================🎉');
      console.log(`🏨 SERVEUR AMANI DÉMARRÉ`);
      console.log(`🌐 Port: ${PORT}`);
      console.log(`🔗 URL: http://localhost:${PORT}`);
      console.log(`⚙️  Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🗄️  Base: ${process.env.DB_NAME}`);
      console.log(`🔔 Notifications temps réel: ACTIVÉES`);
      console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}/socket.io/`);
      console.log('🎉================================🎉');
      console.log('\n📋 Routes principales:');
      console.log('- GET  / (API info + stats connexions)');
      console.log('- GET  /api/health (santé + stats notifications)');
      console.log('- POST /api/auth/login/professional');
      console.log('- POST /api/auth/login/client');
      console.log('- WebSocket /socket.io/ (notifications temps réel)');
      console.log('\n🔔 Événements WebSocket:');
      console.log('- connection/disconnect');
      console.log('- new_notification');
      console.log('- unread_notifications');
      console.log('- mark_notification_read');
      console.log('- get_notifications');
      console.log('- notification_deleted');
      console.log('================================\n');
    });
    
  } catch (error) {
    console.error('❌ Erreur démarrage serveur:', error);
    process.exit(1);
  }
}

startServer();