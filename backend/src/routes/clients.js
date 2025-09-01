const express = require('express');
const rateLimit = require('express-rate-limit');
const { verifyAuth } = require('../controllers/authController');
const { 
  requireAuth, 
  canManageClients 
} = require('../middleware/permissions');

const {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  getClientsStats,
  toggleClientStatus
} = require('../controllers/clientsController');

const router = express.Router();

// Rate limiting pour les actions de création/modification
const modifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requêtes par IP
  message: {
    success: false,
    message: 'Trop de requêtes de modification. Réessayez dans 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

// Middleware d'authentification pour toutes les routes
router.use(verifyAuth);
router.use(requireAuth);
router.use(canManageClients);

// GET /api/clients - Liste des clients avec pagination et recherche
router.get('/', getClients);

// GET /api/clients/stats - Statistiques des clients
router.get('/stats', getClientsStats);

// GET /api/clients/:id - Récupérer un client spécifique
router.get('/:id', getClientById);

// POST /api/clients - Créer un nouveau client
router.post('/', modifyLimiter, createClient);

// PUT /api/clients/:id - Modifier un client
router.put('/:id', modifyLimiter, updateClient);

// DELETE /api/clients/:id - Supprimer un client
router.delete('/:id', modifyLimiter, deleteClient);

// POST /api/clients/:id/toggle-status - Activer/Désactiver un client
router.post('/:id/toggle-status', modifyLimiter, toggleClientStatus);

module.exports = router;