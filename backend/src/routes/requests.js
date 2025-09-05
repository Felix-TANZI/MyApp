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
  getRequestsStats
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

// Middlewares
router.use(verifyAuth);
router.use(requireAuth);
router.use(requireAdmin); // middleware admin qui vérifie le rôle
router.use(adminLimiter);

//  ROUTES GESTION DES DEMANDES 

// GET /api/requests - Liste des demandes en attente
router.get('/', getPendingRequests);

// GET /api/requests/stats - Statistiques des demandes
router.get('/stats', getRequestsStats);

// POST /api/requests/:id/approve-profile - Approuver modification profil
router.post('/:id/approve-profile', approveProfileUpdate);

// POST /api/requests/:id/reject-profile - Rejeter modification profil
router.post('/:id/reject-profile', rejectProfileUpdate);

// POST /api/requests/:id/approve-password - Approuver changement mot de passe
router.post('/:id/approve-password', approvePasswordChange);

// POST /api/requests/:id/reject-password - Rejeter changement mot de passe
router.post('/:id/reject-password', rejectPasswordChange);

module.exports = router;