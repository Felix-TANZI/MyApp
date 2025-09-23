const express = require('express');
const rateLimit = require('express-rate-limit');
const { verifyChatAuth } = require('../controllers/authController');
const { requireAuth } = require('../middleware/permissions');

const {
  getConversations,
  createConversation,
  getConversationById,
  getConversationMessages,
  closeConversation,
  reopenConversation,
  getConversationParticipants,
  getChatStats
} = require('../controllers/chatController');

const router = express.Router();

// Rate limiting pour le chat
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requêtes par IP
  message: {
    success: false,
    message: 'Trop de requêtes de chat. Réessayez dans 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

// Rate limiting pour la création de conversations (plus restrictif)
const createConversationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5, // 5 créations de conversation par heure
  message: {
    success: false,
    message: 'Limite de création de conversations atteinte. Réessayez dans 1 heure.'
  }
});

// Middleware d'authentification pour toutes les routes 
router.use(verifyChatAuth); // Utilisation du bon middleware
router.use(chatLimiter);

// GET /api/chat/conversations - Liste des conversations
router.get('/conversations', getConversations);

// POST /api/chat/conversations - Créer une nouvelle conversation
router.post('/conversations', createConversationLimiter, createConversation);

// GET /api/chat/conversations/:id - Récupérer une conversation spécifique
router.get('/conversations/:id', getConversationById);

// GET /api/chat/conversations/:id/messages - Messages d'une conversation
router.get('/conversations/:id/messages', getConversationMessages);

// POST /api/chat/conversations/:id/close - Fermer une conversation
router.post('/conversations/:id/close', closeConversation);

// POST /api/chat/conversations/:id/reopen - Rouvrir une conversation
router.post('/conversations/:id/reopen', reopenConversation);

// GET /api/chat/conversations/:id/participants - Participants d'une conversation
router.get('/conversations/:id/participants', getConversationParticipants);

// GET /api/chat/stats - Statistiques du chat
router.get('/stats', getChatStats);

module.exports = router;