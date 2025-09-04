// backend/src/routes/users.js
const express = require('express');
const rateLimit = require('express-rate-limit');
const { verifyAuth } = require('../controllers/authController');
const { 
  requireAuth, 
  requireAdmin
} = require('../middleware/permissions');

const {
  getUsers,
  getUsersStats,
  getUserById,
  createUser,
  updateUser,
  changeUserRole,
  changeUserPassword,
  toggleUserStatus,
  deleteUser
} = require('../controllers/usersController');

const router = express.Router();

// Rate limiting pour les actions de modification des utilisateurs
const modifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requêtes par IP (plus restrictif car actions sensibles)
  message: {
    success: false,
    message: 'Trop de requêtes de modification d\'utilisateurs. Réessayez dans 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

// Rate limiting spécial pour création d'utilisateurs (plus restrictif)
const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 10, // Maximum 10 créations d'utilisateurs par heure
  message: {
    success: false,
    message: 'Limite de création d\'utilisateurs atteinte. Réessayez dans 1 heure.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

// Rate limiting pour changements de mots de passe
const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 changements de mot de passe maximum
  message: {
    success: false,
    message: 'Trop de changements de mot de passe. Réessayez dans 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

// Middleware d'authentification et permission admin pour toutes les routes
router.use(verifyAuth);
router.use(requireAuth);
router.use(requireAdmin); // Seuls les admins peuvent gérer les utilisateurs

// GET /api/users - Liste des utilisateurs avec pagination et recherche
router.get('/', getUsers);

// GET /api/users/stats - Statistiques des utilisateurs
router.get('/stats', getUsersStats);

// GET /api/users/:id - Récupérer un utilisateur spécifique
router.get('/:id', getUserById);

// POST /api/users - Créer un nouvel utilisateur
router.post('/', createLimiter, modifyLimiter, createUser);

// PUT /api/users/:id - Modifier un utilisateur (informations de base)
router.put('/:id', modifyLimiter, updateUser);

// PUT /api/users/:id/role - Changer le rôle d'un utilisateur
router.put('/:id/role', modifyLimiter, changeUserRole);

// PUT /api/users/:id/password - Changer le mot de passe d'un utilisateur
router.put('/:id/password', passwordLimiter, changeUserPassword);

// POST /api/users/:id/toggle-status - Activer/Désactiver un utilisateur
router.post('/:id/toggle-status', modifyLimiter, toggleUserStatus);

// DELETE /api/users/:id - Supprimer un utilisateur
router.delete('/:id', modifyLimiter, deleteUser);

module.exports = router;