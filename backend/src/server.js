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

// Import conditionnel des services et routes optionnels
let notificationService;
let notificationRoutes;
let chatService;
let chatRoutes;

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

try {
  chatService = require('./services/chatService');
  console.log('✅ Service de chat chargé');
} catch (error) {
  console.log('⚠️ Service de chat non disponible:', error.message);
}

try {
  chatRoutes = require('./routes/chat');
  console.log('✅ Routes chat chargées');
} catch (error) {
  console.log('⚠️ Routes chat non disponibles:', error.message);
}

const app = express();
const PORT = process.env.PORT || 5000;

// Créer le serveur HTTP
const server = http.createServer(app);

// Configuration Socket.io avec CORS (seulement si au moins un service existe)
let io;
if (notificationService || chatService) {
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

    // Initialiser les services disponibles
    if (notificationService) {
      notificationService.initialize(io);
      console.log('🔔 Service de notifications initialisé');
    }

    if (chatService) {
      chatService.initialize(io);
      console.log('💬 Service de chat initialisé');
    }

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

// Middleware pour ajouter les services aux requêtes (si disponibles)
app.use((req, res, next) => {
  if (notificationService) {
    req.notificationService = notificationService;
  }
  if (chatService) {
    req.chatService = chatService;
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
  const notificationStats = notificationService ? notificationService.getConnectionStats() : { 
    connectedUsers: 0, 
    connectedClients: 0, 
    totalSockets: 0 
  };
  
  const chatStats = chatService ? chatService.getConnectionStats() : {
    totalConnected: 0,
    connectedClients: 0,
    connectedProfessionals: 0,
    activeConversations: 0
  };
  
  res.json({
    message: 'API Amani - Système de Gestion des Factures avec Chat en Temps Réel',
    version: '2.1.0',
    services: {
      notifications: {
        service: notificationService ? 'active' : 'unavailable',
        connectedUsers: notificationStats.connectedUsers,
        connectedClients: notificationStats.connectedClients,
        totalSockets: notificationStats.totalSockets
      },
      chat: {
        service: chatService ? 'active' : 'unavailable',
        totalConnected: chatStats.totalConnected,
        connectedClients: chatStats.connectedClients,
        connectedProfessionals: chatStats.connectedProfessionals,
        activeConversations: chatStats.activeConversations
      }
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
      
      // Admin Requests endpoints
      'GET /api/requests',
      'GET /api/requests/stats',
      'POST /api/requests/:id/approve-profile',
      'POST /api/requests/:id/reject-profile',
      'POST /api/requests/:id/approve-password',
      'POST /api/requests/:id/reject-password',
      
      // Chat endpoints (si disponible)
      ...(chatRoutes ? [
        'GET /api/chat/conversations',
        'POST /api/chat/conversations',
        'GET /api/chat/conversations/:id',
        'GET /api/chat/conversations/:id/messages',
        'POST /api/chat/conversations/:id/close',
        'POST /api/chat/conversations/:id/reopen',
        'GET /api/chat/conversations/:id/participants',
        'GET /api/chat/stats'
      ] : []),
      
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
    websocket: (notificationService || chatService) ? {
      endpoint: '/socket.io/',
      events: [
        'connection',
        // Notifications
        ...(notificationService ? [
          'new_notification',
          'unread_notifications',
          'notifications_list',
          'mark_notification_read',
          'notification_deleted'
        ] : []),
        // Chat
        ...(chatService ? [
          'authenticate',
          'join_conversation',
          'leave_conversation',
          'send_message',
          'new_message',
          'mark_messages_read',
          'user_typing',
          'typing_start',
          'typing_stop',
          'user_joined',
          'user_left'
        ] : []),
        'ping/pong'
      ]
    } : 'unavailable',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', async (req, res) => {
  const dbOk = await testDB();
  const notificationStats = notificationService ? notificationService.getConnectionStats() : { 
    connectedUsers: 0, 
    connectedClients: 0, 
    totalSockets: 0 
  };
  const chatStats = chatService ? chatService.getConnectionStats() : {
    totalConnected: 0,
    connectedClients: 0,
    connectedProfessionals: 0,
    activeConversations: 0
  };
  
  res.json({
    status: 'OK',
    database: dbOk ? 'Connected' : 'Error',
    services: {
      notifications: {
        status: notificationService ? 'running' : 'unavailable',
        connections: notificationStats
      },
      chat: {
        status: chatService ? 'running' : 'unavailable',
        connections: chatStats
      }
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

// Routes admin pour les demandes
try {
  app.use('/api/requests', require('./routes/requests'));
  console.log('✅ Routes requests chargées et montées sur /api/requests');
} catch (error) {
  console.log('⚠️ Routes requests non disponibles:', error.message);
}

// Routes chat (seulement si disponible)
if (chatRoutes) {
  app.use('/api/chat', chatRoutes);
  console.log('✅ Routes chat montées sur /api/chat');
}

// Routes notifications (seulement si disponible)
if (notificationRoutes) {
  app.use('/api/notifications', notificationRoutes);
  console.log('✅ Routes notifications montées sur /api/notifications');
}

// Route 404
app.use('*', (req, res) => {
  const availableEndpoints = [
    'GET /',
    'GET /api/health',
    'POST /api/auth/login/professional',
    'POST /api/auth/login/client',
    'GET /api/requests (admin only)',
    'POST /api/requests/:id/approve-profile (admin only)'
  ];

  if (chatRoutes) {
    availableEndpoints.push('GET /api/chat/conversations (authenticated)');
    availableEndpoints.push('POST /api/chat/conversations (client only)');
  }

  if (notificationService || chatService) {
    availableEndpoints.push('WebSocket /socket.io/ (temps réel)');
  }

  res.status(404).json({
    success: false,
    message: `Route non trouvée: ${req.method} ${req.originalUrl}`,
    availableEndpoints
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
      console.log(`💬 Chat temps réel: ${chatService ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`);
      if (notificationService || chatService) {
        console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}/socket.io/`);
      }
      console.log('🎉================================🎉');
      
      console.log('\n📋 Routes principales:');
      console.log('- GET  / (API info + stats connexions)');
      console.log('- GET  /api/health (santé + stats services)');
      console.log('- POST /api/auth/login/professional');
      console.log('- POST /api/auth/login/client');
      console.log('- GET  /api/requests (demandes admin)');
      console.log('- POST /api/requests/:id/approve-profile (approbation)');
      if (chatService) {
        console.log('- GET  /api/chat/conversations (conversations chat)');
        console.log('- POST /api/chat/conversations (créer conversation)');
      }
      if (notificationService || chatService) {
        console.log('- WebSocket /socket.io/ (temps réel)');
      }
      
      console.log('\n🔔 État des services:');
      console.log(`- Authentification: ✅`);
      console.log(`- Base de données: ✅`);
      console.log(`- WebSocket: ${(notificationService || chatService) ? '✅' : '❌'}`);
      console.log(`- Notifications: ${notificationRoutes ? '✅' : '❌'}`);
      console.log(`- Chat: ${chatService ? '✅' : '❌'}`);
      console.log(`- Requests Admin: ✅`);
      console.log('================================\n');
      
      console.log('🔐 Pour tester:');
      console.log('   Frontend: http://localhost:3000');
      console.log('   API Info: http://localhost:5000');
      console.log('   Santé: http://localhost:5000/api/health');
      console.log('   Demandes Admin: GET http://localhost:5000/api/requests (avec token admin)');
      if (chatService) {
        console.log('   Chat API: GET http://localhost:5000/api/chat/conversations (avec token)');
      }
      console.log('✨ Prêt pour les connexions !\n');
    });
    
  } catch (error) {
    console.error('❌ Erreur démarrage serveur:', error);
    process.exit(1);
  }
}

startServer();