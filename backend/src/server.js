const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Import des routes
const authRoutes = require('./routes/auth');
const clientsRoutes = require('./routes/clients');
const invoicesRoutes = require('./routes/invoices');
const usersRoutes = require('./routes/users'); 
const app = express();
const PORT = process.env.PORT || 5000;

// Configuration CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logger
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.url}`);
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
    
    console.log('Connexion MySQL reussie');
    console.log(`Host: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
    console.log(`Base: ${process.env.DB_NAME}`);
    await connection.end();
    return true;
  } catch (error) {
    console.error('Erreur MySQL:', error.message);
    return false;
  }
}

// Routes principales
app.get('/', (req, res) => {
  res.json({
    message: 'API Hilton Yaounde - Systeme de Gestion des Factures',
    version: '1.0.0',
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
      'DELETE /api/invoices/:id'
    ],
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', async (req, res) => {
  const dbOk = await testDB();
  res.json({
    status: 'OK',
    database: dbOk ? 'Connected' : 'Error',
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

// Route 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route non trouvee: ${req.method} ${req.originalUrl}`,
    availableEndpoints: [
      'GET /',
      'GET /api/health',
      'POST /api/auth/login/professional',
      'POST /api/auth/login/client',
      'GET /api/users (Admin only)',
      'POST /api/users (Admin only)',
      'GET /api/clients',
      'POST /api/clients',
      'GET /api/invoices',
      'POST /api/invoices'
    ]
  });
});

// Gestion erreurs globales
app.use((error, req, res, next) => {
  console.error('Erreur serveur:', error);
  
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
      console.error('Impossible de se connecter a la base de donnees');
      process.exit(1);
    }
    
    // Démarrer le serveur
    app.listen(PORT, () => {
      console.log('\n================================');
      console.log(`SERVEUR HILTON DEMARRE`);
      console.log(`Port: ${PORT}`);
      console.log(`URL: http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Base: ${process.env.DB_NAME}`);
      console.log('================================');
      console.log('Routes disponibles:');
      console.log('- GET  /')
      console.log('- GET  /api/health')
      console.log('- POST /api/auth/login/professional')
      console.log('- POST /api/auth/login/client')
      console.log('- POST /api/auth/logout')
      console.log('- GET  /api/auth/profile')
      console.log('- GET  /api/users (Admin)');
      console.log('- POST /api/users (Admin)');
      console.log('- PUT  /api/users/:id (Admin)');
      console.log('- DELETE /api/users/:id (Admin)');
      console.log('- GET  /api/clients')
      console.log('- POST /api/clients')
      console.log('- PUT  /api/clients/:id')
      console.log('- DELETE /api/clients/:id')
      console.log('- GET  /api/invoices')
      console.log('- POST /api/invoices')
      console.log('- PUT  /api/invoices/:id')
      console.log('- DELETE /api/invoices/:id')
      console.log('- GET  /api/invoices/:id/pdf')
      console.log('================================\n');
    });
    
  } catch (error) {
    console.error('Erreur demarrage serveur:', error);
    process.exit(1);
  }
}

startServer();