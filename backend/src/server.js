// backend/src/server.js
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

// Import des routes principales (qui existent)
const authRoutes = require('./routes/auth');
const clientsRoutes = require('./routes/clients');
const invoicesRoutes = require('./routes/invoices');
const usersRoutes = require('./routes/users');

// Import conditionnel des routes optionnelles
let notificationService;
let notificationRoutes;

try {
  notificationService = require('./services/notificationService');
  console.log('✅ Service de notifications chargé');
} catch (error) {
  console.log('⚠️ Service de notifications non disponible:', error.message);
}

try {
  notificationRoutes = require('./routes/notifications');
  console.log('✅ Routes notifications chargées');
} catch (error) {
  console.log('⚠️ Routes notifications non disponibles:', error.message);
}

const app = express();
const PORT = process.env.PORT || 5000;

// Créer le serveur HTTP
const server = http.createServer(app);

// Configuration Socket.io avec CORS (seulement si le service existe)
let io;
if (notificationService) {
  try {
    io = socketIo(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });

    // Initialiser le service de notifications
    notificationService.initialize(io);
    console.log('🔔 Service de notifications initialisé');
  } catch (error) {
    console.log('⚠️ Erreur initialisation WebSocket:', error.message);
  }
}

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

// Middleware pour ajouter le service de notifications aux requêtes (si disponible)
app.use((req, res, next) => {
  if (notificationService) {
    req.notificationService = notificationService;
  }
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
  const stats = notificationService ? notificationService.getConnectionStats() : { 
    connectedUsers: 0, 
    connectedClients: 0, 
    totalSockets: 0 
  };
  
  res.json({
    message: 'API Amani - Système de Gestion des Factures avec Notifications Temps Réel',
    version: '2.0.0',
    notifications: {
      service: notificationService ? 'active' : 'unavailable',
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
      
      // Notifications endpoints (si disponible)
      ...(notificationRoutes ? [
        'GET /api/notifications',
        'POST /api/notifications/send',
        'PUT /api/notifications/:id/read',
        'DELETE /api/notifications/:id',
        'DELETE /api/notifications/clear-all',
        'GET /api/notifications/stats'
      ] : [])
    ],
    websocket: notificationService ? {
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
    } : 'unavailable',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', async (req, res) => {
  const dbOk = await testDB();
  const stats = notificationService ? notificationService.getConnectionStats() : { 
    connectedUsers: 0, 
    connectedClients: 0, 
    totalSockets: 0 
  };
  
  res.json({
    status: 'OK',
    database: dbOk ? 'Connected' : 'Error',
    notifications: {
      service: notificationService ? 'running' : 'unavailable',
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

// Routes client (avec gestion d'erreur)
try {
  app.use('/api/client', require('./routes/client'));
  console.log('✅ Routes client chargées');
} catch (error) {
  console.log('⚠️ Routes client non disponibles:', error.message);
}

// Routes admin pour les demandes (avec gestion d'erreur)
try {
  app.use('/api/requests', require('./routes/requests'));
  console.log('✅ Routes requests chargées');
} catch (error) {
  console.log('⚠️ Routes requests non disponibles:', error.message);
}

// Routes notifications (seulement si disponible)
if (notificationRoutes) {
  app.use('/api/notifications', notificationRoutes);
  console.log('✅ Routes notifications montées');
}

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
      'WebSocket /socket.io/' + (notificationService ? ' (actif)' : ' (indisponible)')
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
      console.log('🔧 Suggestions:');
      console.log('1. Vérifiez que MySQL est démarré (XAMPP/WAMP)');
      console.log('2. Vérifiez le port 3307 dans votre .env');
      console.log('3. Testez: mysql -h 127.0.0.1 -P 3307 -u root -p');
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
      console.log(`🔔 Notifications temps réel: ${notificationService ? 'ACTIVÉES' : 'DÉSACTIVÉES'}`);
      if (notificationService) {
        console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}/socket.io/`);
      }
      console.log('🎉================================🎉');
      console.log('\n📋 Routes principales:');
      console.log('- GET  / (API info + stats connexions)');
      console.log('- GET  /api/health (santé + stats notifications)');
      console.log('- POST /api/auth/login/professional');
      console.log('- POST /api/auth/login/client');
      if (notificationService) {
        console.log('- WebSocket /socket.io/ (notifications temps réel)');
      }
      console.log('\n🔔 État des services:');
      console.log(`- Authentification: ✅`);
      console.log(`- Base de données: ✅`);
      console.log(`- WebSocket: ${notificationService ? '✅' : '❌'}`);
      console.log(`- Notifications: ${notificationRoutes ? '✅' : '❌'}`);
      console.log('================================\n');
      
      console.log('🔐 Pour tester:');
      console.log('   Frontend: http://localhost:3000');
      console.log('   API Info: http://localhost:5000');
      console.log('   Santé: http://localhost:5000/api/health');
      console.log('✨ Prêt pour les connexions !\n');
    });
    
  } catch (error) {
    console.error('❌ Erreur démarrage serveur:', error);
    process.exit(1);
  }
}

startServer();