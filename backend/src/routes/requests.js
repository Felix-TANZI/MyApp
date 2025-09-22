const express = require('express');
const rateLimit = require('express-rate-limit');
const { verifyAuth } = require('../controllers/authController');
const { requireAuth, requireAdmin } = require('../middleware/permissions');

const {
  getPendingRequests,
  approveProfileUpdate,
  rejectProfileUpdate,
  approvePasswordChange,
  rejectPasswordChange,
  getRequestsStats,
  getRequestById
} = require('../controllers/adminRequestsController');

const router = express.Router();

// Rate limiting pour les actions admin
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requêtes par IP
  message: {
    success: false,
    message: 'Limite administrative atteinte. Réessayez dans 15 minutes.'
  }
});

// Middleware pour vérifier les permissions spéciales pour les demandes
const requireRequestAccess = async (req, res, next) => {
  try {
    const user = req.user;
    
    // Les admins ont toujours accès
    if (user.role === 'admin') {
      return next();
    }
    
    // Les autres rôles peuvent voir les demandes des clients qu'ils ont créés
    if (['commercial', 'comptable'].includes(user.role)) {
      return next();
    }
    
    // Accès refusé pour les autres rôles
    return res.status(403).json({
      success: false,
      message: 'Accès non autorisé à la gestion des demandes'
    });
  } catch (error) {
    console.error('Erreur vérification permissions demandes:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur de vérification des permissions'
    });
  }
};

// Middlewares globaux pour toutes les routes
router.use(verifyAuth);
router.use(requireAuth);
router.use(requireRequestAccess); // Permissions spéciales pour les demandes
router.use(adminLimiter);

// ROUTES GESTION DES DEMANDES

// GET /api/requests - Liste des demandes en attente avec permissions
router.get('/', getPendingRequests);

// GET /api/requests/stats - Statistiques des demandes avec permissions
router.get('/stats', getRequestsStats);

// GET /api/requests/:id - Détail d'une demande spécifique
router.get('/:id', getRequestById);

// POST /api/requests/:id/approve-profile - Approuver modification profil
router.post('/:id/approve-profile', approveProfileUpdate);

// POST /api/requests/:id/reject-profile - Rejeter modification profil
router.post('/:id/reject-profile', rejectProfileUpdate);

// POST /api/requests/:id/approve-password - Approuver changement mot de passe
router.post('/:id/approve-password', approvePasswordChange);

// POST /api/requests/:id/reject-password - Rejeter changement mot de passe
router.post('/:id/reject-password', rejectPasswordChange);

module.exports = router;