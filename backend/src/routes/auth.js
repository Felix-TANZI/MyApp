const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  loginProfessional,
  loginClient,
  logout,
  verifyAuth,
  getProfile
} = require('../controllers/authController');

const router = express.Router();

// Rate limiting utilise pour les tentatives de connexion
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 tentatives par IP
  message: {
    success: false,
    message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});


// POST /api/auth/login/professional
router.post('/login/professional', loginLimiter, loginProfessional);

// POST /api/auth/login/client  
router.post('/login/client', loginLimiter, loginClient);

// POST /api/auth/logout
router.post('/logout', logout);

// GET /api/auth/profile
router.get('/profile', verifyAuth, getProfile);

// GET /api/auth/verify (vérifier si token valide)
router.get('/verify', verifyAuth, (req, res) => {
  res.json({
    success: true,
    message: 'Token valide',
    user: {
      id: req.user.id,
      type: req.user.type
    }
  });
});

module.exports = router;