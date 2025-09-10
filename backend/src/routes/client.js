const express = require('express');
const rateLimit = require('express-rate-limit');
const { verifyAuth } = require('../controllers/authController');
const { requireAuth } = require('../middleware/permissions');

const {
  getMyInvoices,
  getMyInvoiceById,
  downloadMyInvoicePDF,
  getMyProfile,
  requestProfileUpdate,
  requestPasswordChange,
  getMyStats,
  getMyNotifications,
  markNotificationAsRead
} = require('../controllers/clientController');

const router = express.Router();

// Rate limiting pour les clients
const clientLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes par IP
  message: {
    success: false,
    message: 'Trop de requêtes. Réessayez dans 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

// Rate limiting pour les modifications (plus restrictif)
const modifyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5, // 5 modifications par heure
  message: {
    success: false,
    message: 'Limite de modifications atteinte. Réessayez dans 1 heure.'
  }
});

// Middleware pour vérifier que l'utilisateur est un client
const requireClient = (req, res, next) => {
  if (req.user.type !== 'client') {
    return res.status(403).json({
      success: false,
      message: 'Accès réservé aux clients'
    });
  }
  next();
};

// Appliquer les middlewares à toutes les routes
router.use(verifyAuth);
router.use(requireAuth); // Utilise middleware
router.use(requireClient);
router.use(clientLimiter);

// ROUTES FACTURES
// GET /api/client/factures - Mes factures
router.get('/factures', getMyInvoices);

// GET /api/client/factures/:id - Détail de ma facture
router.get('/factures/:id', getMyInvoiceById);

// GET /api/client/factures/:id/pdf - PDF de ma facture
router.get('/factures/:id/pdf', downloadMyInvoicePDF);

// ROUTES PROFIL 
// GET /api/client/profile - Mon profil
router.get('/profile', getMyProfile);

// PUT /api/client/profile - Demander modification profil
router.put('/profile', modifyLimiter, requestProfileUpdate);

// PUT /api/client/password - Demander changement mot de passe
router.put('/password', modifyLimiter, requestPasswordChange);

//  ROUTES STATISTIQUES 
// GET /api/client/stats - Mes statistiques
router.get('/stats', getMyStats);

//  ROUTES NOTIFICATIONS 
// GET /api/client/notifications - Mes notifications
router.get('/notifications', getMyNotifications);

// PUT /api/client/notifications/:id/read - Marquer notification comme lue
router.put('/notifications/:id/read', markNotificationAsRead);

module.exports = router;