const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

// Import des routes principales
const authRoutes = require('./routes/auth');
const clientsRoutes = require('./routes/clients');
const invoicesRoutes = require('./routes/invoices');
const usersRoutes = require('./routes/users');

// Import conditionnel des services et routes optionnels avec gestion d'erreur 
let notificationService;
let notificationRoutes;
let chatService;
let chatRoutes;
let assistantAmaniService;
let assistantRoutes;

// Chargement du service de notifications
try {
  notificationService = require('./services/notificationService');
  console.log('✅ Service de notifications chargé avec succès');
} catch (error) {
  console.log('⚠️ Service de notifications non disponible:', error.code || error.message);
  notificationService = null;
}

// Chargement des routes notifications
try {
  notificationRoutes = require('./routes/notifications');
  console.log('✅ Routes notifications chargées avec succès');
} catch (error) {
  console.log('⚠️ Routes notifications non disponibles:', error.code || error.message);
  notificationRoutes = null;
}

// Chargement du service de chat
try {
  chatService = require('./services/chatService');
  console.log('✅ Service de chat chargé avec succès');
} catch (error) {
  console.error('❌ ERREUR CRITIQUE: Service de chat non disponible:', error.message);
  console.error('Stack:', error.stack);
  chatService = null;
}

// Chargement des routes chat
try {
  chatRoutes = require('./routes/chat');
  console.log('✅ Routes chat chargées avec succès');
} catch (error) {
  console.error('❌ ERREUR CRITIQUE: Routes chat non disponibles:', error.message);
  console.error('Stack:', error.stack);
  chatRoutes = null;
}

// Chargement du service Assistant Amani
try {
  assistantAmaniService = require('./services/assistantAmaniService');
  console.log('✅ Service Assistant Amani chargé avec succès');
} catch (error) {
  console.log('⚠️ Service Assistant Amani non disponible:', error.code || error.message);
  assistantAmaniService = null;
}

// Chargement des routes assistant
try {
  assistantRoutes = require('./routes/assistant');
  console.log('✅ Routes Assistant Amani chargées avec succès');
} catch (error) {
  console.log('⚠️ Routes Assistant Amani non disponibles:', error.code || error.message);
  assistantRoutes = null;
}

const app = express();
const PORT = process.env.PORT || 5000;

// Créer le serveur HTTP
const server = http.createServer(app);

// Configuration Socket.io avec CORS
let io;
if (notificationService || chatService) {
  try {
    io = socketIo(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization']
      },
      transports: ['websocket', 'polling'],
      pingTimeout: parseInt(process.env.WS_PING_TIMEOUT) || 60000,
      pingInterval: parseInt(process.env.WS_PING_INTERVAL) || 25000,
      connectTimeout: 45000,
      allowEIO3: true
    });

    console.log('🔗 Socket.IO configuré avec succès');

    // Initialiser les services disponibles avec gestion d'erreur
    if (notificationService) {
      try {
        // Notifications sur le namespace par défaut
        notificationService.initialize(io);
        console.log('🔔 Service de notifications initialisé avec succès');
      } catch (error) {
        console.error('❌ Erreur initialisation service notifications:', error);
        notificationService = null;
      }
    }

    if (chatService) {
      try {
        // Chat sur un namespace dédié
        const chatNamespace = io.of('/chat');
        chatService.initialize(chatNamespace);
        console.log('💬 Service de chat initialisé avec succès');
      } catch (error) {
        console.error('❌ Erreur initialisation service chat:', error);
        chatService = null;
      }
    }

    // Gestion des connexions globales
    io.on('connection', (socket) => {
      console.log(`🔌 Nouvelle connexion WebSocket: ${socket.id}`);
      
      socket.on('disconnect', (reason) => {
        console.log(`❌ Déconnexion WebSocket: ${socket.id} (${reason})`);
      });

      // Heartbeat pour garder la connexion alive
      socket.on('ping', () => {
        socket.emit('pong');
      });
    });

  } catch (error) {
    console.error('❌ Erreur critique initialisation WebSocket:', error);
    io = null;
  }
} else {
  console.log('⚠️ Aucun service WebSocket disponible - WebSocket non initialisé');
}

// Configuration CORS pour Express
app.use(cors({
  origin: function(origin, callback) {
    // Permettre les requêtes sans origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('🚫 Origin bloquée:', origin);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  optionsSuccessStatus: 200
}));

// Middleware pour les requêtes preflight
app.options('*', cors());

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logger amélioré avec plus de détails
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const userAgent = req.get('User-Agent') || 'Unknown';
  const origin = req.get('Origin') || 'No-Origin';
  
  console.log(`${timestamp} - ${req.method} ${req.url} - Origin: ${origin}`);
  
  // Log des headers d'auth pour debug (sans exposer le token)
  if (req.headers.authorization) {
    console.log(`  - Auth: Bearer ${req.headers.authorization.substring(0, 20)}...`);
  }
  
  next();
});

// Middleware pour ajouter les services aux requêtes
app.use((req, res, next) => {
  if (notificationService) {
    req.notificationService = notificationService;
  }
  if (chatService) {
    req.chatService = chatService;
  }
  if (assistantAmaniService) {
    req.assistantAmaniService = assistantAmaniService;
  }
  next();
});

// Test de connexion MySQL
async function testDB() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT || 3307,
      user: process.env.DB_USER || 'root', 
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'gestionFac'
    });
    
    // Test avec une requête 
    await connection.execute('SELECT 1 as test');
    
    console.log('✅ Connexion MySQL réussie');
    console.log(`📡 Host: ${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 3307}`);
    console.log(`🗄️  Base: ${process.env.DB_NAME || 'gestionFac'}`);
    
    await connection.end();
    return true;
  } catch (error) {
    console.error('❌ Erreur MySQL:', error.message);
    console.error('🔧 Vérifiez que MySQL est démarré et accessible');
    return false;
  }
}

// Routes principales
app.get('/', async (req, res) => {
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

  // Stats de l'assistant
  let assistantStats = null;
  if (assistantAmaniService) {
    try {
      assistantStats = await assistantAmaniService.getStats();
    } catch (error) {
      assistantStats = { enabled: false, error: error.message };
    }
  }
  
  res.json({
    message: 'API Amani - Système de Gestion des Factures avec Assistant IA',
    version: '1.1.0',
    status: 'running',
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
        activeConversations: chatStats.activeConversations,
        // Info assistant dans les stats chat
        assistant: chatStats.assistantAmani || null
      },
      // Section dédiée à l'assistant
      assistantAmani: assistantStats || {
        service: assistantAmaniService ? 'loaded' : 'unavailable',
        enabled: false,
        error: assistantAmaniService ? null : 'Service non chargé'
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
      
      // Chat endpoints
      ...(chatRoutes ? [
        'GET /api/chat/conversations - Liste des conversations',
        'POST /api/chat/conversations - Créer une conversation (client)',
        'GET /api/chat/conversations/:id - Détails conversation',
        'GET /api/chat/conversations/:id/messages - Messages',
        'POST /api/chat/conversations/:id/close - Fermer (pro)',
        'POST /api/chat/conversations/:id/reopen - Rouvrir (pro)',
        'GET /api/chat/conversations/:id/participants - Participants',
        'GET /api/chat/stats - Statistiques (pro)'
      ] : ['❌ Chat endpoints non disponibles']),
      
      // Assistant endpoints
      ...(assistantRoutes ? [
        'GET /api/assistant/stats - Statistiques assistant (pro)',
        'POST /api/assistant/test - Tester l\'assistant (admin)',
        'GET /api/assistant/status - Statut de l\'assistant',
        'POST /api/assistant/toggle - Activer/désactiver (admin)'
      ] : ['❌ Assistant endpoints non disponibles']),
      
      // Notifications endpoints
      ...(notificationRoutes ? [
        'GET /api/notifications',
        'POST /api/notifications/send',
        'PUT /api/notifications/:id/read',
        'DELETE /api/notifications/:id',
        'DELETE /api/notifications/clear-all',
        'GET /api/notifications/stats'
      ] : ['❌ Notification endpoints non disponibles'])
    ],
    websocket: (notificationService || chatService) ? {
      endpoint: '/socket.io/',
      status: 'active',
      events: [
        'connection',
        'disconnect',
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
          'chat_authenticate - Authentification',
          'join_conversation - Rejoindre conversation',
          'leave_conversation - Quitter conversation',
          'send_message - Envoyer message',
          'new_message - Nouveau message reçu (incluant Assistant Amani)',
          'mark_messages_read - Marquer comme lu',
          'user_typing - Indicateur frappe',
          'typing_start/typing_stop - Contrôle frappe',
          'user_joined/user_left - Gestion participants'
        ] : []),
        'ping/pong - Heartbeat'
      ]
    } : {
      status: 'unavailable',
      reason: 'Aucun service WebSocket disponible'
    },
    // Information spécifique sur l'assistant
    assistantAmani: {
      enabled: assistantStats?.enabled || false,
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      activationCondition: "Aucun professionnel en ligne",
      features: [
        "Réponse automatique aux questions fréquentes",
        "Gestion des factures et paiements", 
        "Informations sur les services hôteliers",
        "Escalade intelligente vers les professionnels",
        "Support multilingue (français)"
      ]
    },
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

  // Health check de l'assistant
  let assistantHealth = null;
  if (assistantAmaniService) {
    try {
      assistantHealth = await assistantAmaniService.getStats();
      assistantHealth.status = assistantHealth.enabled ? 'healthy' : 'disabled';
    } catch (error) {
      assistantHealth = {
        status: 'error',
        error: error.message
      };
    }
  } else {
    assistantHealth = {
      status: 'unavailable',
      reason: 'Service non chargé'
    };
  }
  
  const healthStatus = {
    status: dbOk ? 'healthy' : 'degraded',
    database: dbOk ? 'Connected' : 'Error',
    services: {
      notifications: {
        status: notificationService ? 'running' : 'unavailable',
        connections: notificationStats
      },
      chat: {
        status: chatService ? 'running' : 'unavailable',
        connections: chatStats
      },
      // Health de l'assistant
      assistantAmani: assistantHealth
    },
    environment: {
      node_env: process.env.NODE_ENV || 'development',
      port: PORT,
      db_host: process.env.DB_HOST || '127.0.0.1',
      db_port: process.env.DB_PORT || 3307,
      // Variables d'environnement de l'assistant
      openai_configured: !!process.env.OPENAI_API_KEY,
      assistant_enabled: process.env.ASSISTANT_ENABLED === 'true'
    },
    timestamp: new Date().toISOString()
  };
  
  res.status(dbOk ? 200 : 503).json(healthStatus);
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
  const clientRoutes = require('./routes/client');
  app.use('/api/client', clientRoutes);
  console.log('✅ Routes client chargées et montées sur /api/client');
} catch (error) {
  console.log('⚠️ Routes client non disponibles:', error.message);
  
  app.use('/api/client/*', (req, res) => {
    res.status(503).json({
      success: false,
      message: 'Service client temporairement indisponible',
      error: 'CLIENT_ROUTES_ERROR'
    });
  });
}

// Routes admin pour les demandes
try {
  const requestsRoutes = require('./routes/requests');
  app.use('/api/requests', requestsRoutes);
  console.log('✅ Routes requests chargées et montées sur /api/requests');
} catch (error) {
  console.log('⚠️ Routes requests non disponibles:', error.message);
  
  app.use('/api/requests/*', (req, res) => {
    res.status(503).json({
      success: false,
      message: 'Service de demandes administratives temporairement indisponible',
      error: 'REQUESTS_ROUTES_ERROR'
    });
  });
}

// Routes chat - Gestion avec fallback
if (chatRoutes && chatService) {
  try {
    app.use('/api/chat', chatRoutes);
    console.log('✅ Routes chat montées sur /api/chat avec succès');
    
    console.log('🧪 Test des routes chat:');
    console.log('   ✅ GET  /api/chat/conversations - Disponible');
    console.log('   ✅ POST /api/chat/conversations - Disponible');  
    console.log('   ✅ GET  /api/chat/stats - Disponible');
    console.log('   ✅ WebSocket chat - Service actif');
    
  } catch (error) {
    console.error('❌ ERREUR CRITIQUE lors du montage des routes chat:', error);
    
    app.use('/api/chat/*', (req, res) => {
      console.error(`❌ Tentative d'accès à route chat indisponible: ${req.method} ${req.originalUrl}`);
      res.status(503).json({
        success: false,
        message: 'Service de chat temporairement indisponible',
        error: 'CHAT_ROUTES_MOUNT_ERROR',
        timestamp: new Date().toISOString()
      });
    });
  }
} else {
  console.error('❌ CHAT NON DISPONIBLE - Raisons possibles:');
  if (!chatRoutes) console.error('   - Routes chat non chargées');
  if (!chatService) console.error('   - Service chat non chargé');
  
  app.use('/api/chat/*', (req, res) => {
    const reasons = [];
    if (!chatRoutes) reasons.push('Routes chat non chargées');
    if (!chatService) reasons.push('Service chat non initialisé');
    
    console.log(`⚠️ Tentative d'accès au chat: ${req.method} ${req.originalUrl}`);
    
    res.status(503).json({
      success: false,
      message: 'Service de chat non disponible',
      error: 'CHAT_SERVICE_UNAVAILABLE',
      reasons: reasons,
      timestamp: new Date().toISOString()
    });
  });
}

// Routes Assistant Amani
if (assistantRoutes && assistantAmaniService) {
  try {
    app.use('/api/assistant', assistantRoutes);
    console.log('✅ Routes Assistant Amani montées sur /api/assistant avec succès');
    
    console.log('🧪 Test des routes Assistant Amani:');
    console.log('   ✅ GET  /api/assistant/stats - Disponible');
    console.log('   ✅ POST /api/assistant/test - Disponible');
    console.log('   ✅ GET  /api/assistant/status - Disponible');
    console.log('   ✅ Service Assistant Amani - Actif');
    
  } catch (error) {
    console.error('❌ ERREUR CRITIQUE lors du montage des routes Assistant Amani:', error);
    
    app.use('/api/assistant/*', (req, res) => {
      console.error(`❌ Tentative d'accès à route Assistant indisponible: ${req.method} ${req.originalUrl}`);
      res.status(503).json({
        success: false,
        message: 'Service Assistant Amani temporairement indisponible',
        error: 'ASSISTANT_ROUTES_MOUNT_ERROR',
        timestamp: new Date().toISOString()
      });
    });
  }
} else {
  console.error('❌ ASSISTANT AMANI NON DISPONIBLE - Raisons possibles:');
  if (!assistantRoutes) console.error('   - Routes Assistant non chargées');
  if (!assistantAmaniService) console.error('   - Service Assistant non chargé');
  
  app.use('/api/assistant/*', (req, res) => {
    const reasons = [];
    if (!assistantRoutes) reasons.push('Routes Assistant non chargées');
    if (!assistantAmaniService) reasons.push('Service Assistant non initialisé');
    
    console.log(`⚠️ Tentative d'accès à l'Assistant: ${req.method} ${req.originalUrl}`);
    
    res.status(503).json({
      success: false,
      message: 'Service Assistant Amani non disponible',
      error: 'ASSISTANT_SERVICE_UNAVAILABLE',
      reasons: reasons,
      suggestions: [
        'Vérifiez que la clé OpenAI API est configurée dans .env',
        'Contrôlez les dépendances (npm install openai)',
        'Vérifiez les paramètres ASSISTANT_* dans .env',
        'Redémarrez le serveur'
      ],
      timestamp: new Date().toISOString()
    });
  });
}

// Routes notifications
if (notificationRoutes && notificationService) {
  try {
    app.use('/api/notifications', notificationRoutes);
    console.log('✅ Routes notifications montées sur /api/notifications');
  } catch (error) {
    console.error('❌ Erreur montage routes notifications:', error);
    
    app.use('/api/notifications/*', (req, res) => {
      res.status(503).json({
        success: false,
        message: 'Service de notifications temporairement indisponible',
        error: 'NOTIFICATION_ROUTES_ERROR'
      });
    });
  }
}

// Route 404 améliorée
app.use('*', (req, res) => {
  const isApiRoute = req.originalUrl.startsWith('/api/');
  
  console.log(`❌ Route 404: ${req.method} ${req.originalUrl}`);

  const availableEndpoints = [
    '✅ GET / - API info et statistiques',
    '✅ GET /api/health - Santé du système',
    '✅ POST /api/auth/login/professional - Connexion pro',
    '✅ POST /api/auth/login/client - Connexion client'
  ];

  if (chatRoutes && chatService) {
    availableEndpoints.push('✅ GET /api/chat/conversations - Chat (authentifié)');
    availableEndpoints.push('✅ WebSocket /socket.io/ - Chat temps réel');
  }

  if (assistantRoutes && assistantAmaniService) {
    availableEndpoints.push('✅ GET /api/assistant/stats - Assistant (pro auth)');
    availableEndpoints.push('✅ GET /api/assistant/status - Statut assistant');
  }

  const response = {
    success: false,
    message: `Route non trouvée: ${req.method} ${req.originalUrl}`,
    availableEndpoints,
    debug: {
      services: {
        chatLoaded: !!chatService,
        assistantLoaded: !!assistantAmaniService,
        notificationLoaded: !!notificationService
      }
    },
    timestamp: new Date().toISOString()
  };

  res.status(404).json(response);
});

// Gestion erreurs globales
app.use((error, req, res, next) => {
  console.error('❌ Erreur serveur globale:', {
    message: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
  // Erreur de validation JSON
  if (error instanceof SyntaxError && error.status === 400) {
    return res.status(400).json({
      success: false,
      message: 'Format JSON invalide dans la requête',
      error: 'INVALID_JSON'
    });
  }

  // Erreur de token JWT
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Token d\'authentification invalide',
      error: 'INVALID_TOKEN'
    });
  }

  // Erreur de base de données
  if (error.code && error.code.startsWith('ER_')) {
    return res.status(500).json({
      success: false,
      message: 'Erreur de base de données',
      error: 'DATABASE_ERROR'
    });
  }
  
  res.status(500).json({
    success: false,
    message: 'Erreur interne du serveur',
    error: 'INTERNAL_SERVER_ERROR',
    ...(process.env.NODE_ENV === 'development' && { 
      details: error.message,
      stack: error.stack 
    }),
    timestamp: new Date().toISOString()
  });
});

// Démarrage serveur avec vérifications complètes
async function startServer() {
  try {
    console.log('🚀 Démarrage du serveur Amani...');
    
    // Test base de données
    console.log('📊 Vérification de la base de données...');
    const dbConnected = await testDB();
    
    if (!dbConnected) {
      console.error('❌ ERREUR CRITIQUE: Impossible de se connecter à la base de données');
      process.exit(1);
    }
    
    // Démarrer le serveur HTTP avec Socket.io
    server.listen(PORT, () => {
      console.log('\n🎉==================================================🎉');
      console.log(`🏨 SERVEUR AMANI DÉMARRÉ AVEC SUCCÈS`);
      console.log(`🌐 Port: ${PORT}`);
      console.log(`🔗 URL locale: http://localhost:${PORT}`);
      console.log(`⚙️  Environnement: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🗄️  Base de données: ${process.env.DB_NAME || 'gestionFac'} ✅`);
      
      // Statut des services temps réel
      if (notificationService || chatService) {
        console.log(`📡 WebSocket: http://localhost:${PORT}/socket.io/ ✅`);
        console.log(`🔔 Notifications temps réel: ${notificationService ? '✅ ACTIF' : '❌ INACTIF'}`);
        console.log(`💬 Chat temps réel: ${chatService ? '✅ ACTIF' : '❌ INACTIF'}`);
      } else {
        console.log(`📡 WebSocket: ❌ AUCUN SERVICE DISPONIBLE`);
      }
      
      console.log('🎉==================================================🎉');
      
      console.log('\n🔔 État détaillé des services:');
      console.log(`- Base de données MySQL: ✅ Connectée`);
      console.log(`- Authentification JWT: ✅ Active`);
      console.log(`- WebSocket global: ${(notificationService || chatService) ? '✅ Actif' : '❌ Inactif'}`);
      console.log(`- Service notifications: ${notificationService ? '✅ Chargé' : '❌ Non chargé'}`);
      console.log(`- Service chat: ${chatService ? '✅ Chargé' : '❌ Non chargé'}`);
      console.log(`- Routes chat: ${chatRoutes ? '✅ Montées' : '❌ Non montées'}`);
      console.log(`- Assistant Amani: ${assistantAmaniService ? (assistantAmaniService.isEnabled() ? '🤖 Actif' : '⚠️ Chargé mais désactivé') : '❌ Non chargé'}`);
      console.log(`- Routes assistant: ${assistantRoutes ? '✅ Montées' : '❌ Non montées'}`);
      console.log(`- Routes notifications: ${notificationRoutes ? '✅ Montées' : '❌ Non montées'}`);
      console.log(`- Gestion des demandes admin: ✅ Active`);
      
      console.log('\n🔗 Pour tester le système:');
      console.log('📱 Frontend: http://localhost:3000');
      console.log('🌐 API Info: http://localhost:5000');
      console.log('💊 Santé système: http://localhost:5000/api/health');
      
      if (chatRoutes && chatService) {
        console.log('💬 Test chat API: GET http://localhost:5000/api/chat/conversations');
      }
      
      if (assistantRoutes && assistantAmaniService) {
        console.log('🤖 Test assistant: GET http://localhost:5000/api/assistant/status');
      }
      
      console.log('================================');
      console.log('✨ Serveur prêt pour les connexions !');
      console.log('🔍 Surveillez les logs pour les connexions WebSocket');
      console.log('================================\n');
    });
    
  } catch (error) {
    console.error('❌ Erreur critique lors du démarrage:', error);
    process.exit(1);
  }
}

// Gestion des signaux système
process.on('SIGINT', () => {
  console.log('\n🛑 Signal SIGINT reçu, arrêt du serveur...');
  server.close(() => {
    console.log('✅ Serveur fermé proprement');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Signal SIGTERM reçu, arrêt du serveur...');
  server.close(() => {
    console.log('✅ Serveur fermé proprement');
    process.exit(0);
  });
});

startServer();