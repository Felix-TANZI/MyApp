const express = require('express');
const { verifyAuth } = require('../controllers/authController');
const assistantAmaniService = require('../services/assistantAmaniService');

const router = express.Router();

// Middleware d'authentification pour toutes les routes
router.use(verifyAuth);

// GET /api/assistant/stats - Statistiques de l'assistant (admins uniquement)
router.get('/stats', async (req, res) => {
  try {
    const { type: userType, decoded } = req.user;
    
    // Seuls les professionnels peuvent voir les stats
    if (userType !== 'user' || !['admin', 'commercial'].includes(decoded.role)) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé'
      });
    }

    const stats = await assistantAmaniService.getStats();
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Erreur récupération stats assistant:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des statistiques'
    });
  }
});

// POST /api/assistant/test - Tester l'assistant (admins uniquement)
router.post('/test', async (req, res) => {
  try {
    const { type: userType, decoded } = req.user;
    
    // Seuls les admins peuvent tester l'assistant
    if (userType !== 'user' || decoded.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Seuls les administrateurs peuvent tester l\'assistant'
      });
    }

    if (!assistantAmaniService.isEnabled()) {
      return res.status(400).json({
        success: false,
        message: 'Assistant Amani non activé'
      });
    }

    const testResponse = await assistantAmaniService.testAssistant();
    
    res.json({
      success: true,
      data: testResponse,
      message: 'Test de l\'assistant exécuté'
    });

  } catch (error) {
    console.error('Erreur test assistant:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du test de l\'assistant',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/assistant/status - Statut de l'assistant
router.get('/status', async (req, res) => {
  try {
    const { type: userType } = req.user;
    
    if (userType !== 'user') {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé'
      });
    }

    const professionnelsEnLigne = await assistantAmaniService.checkOnlineProfessionals();
    
    res.json({
      success: true,
      data: {
        enabled: assistantAmaniService.isEnabled(),
        active: professionnelsEnLigne === 0,
        professionnelsEnLigne,
        model: process.env.OPENAI_MODEL || "gpt-4o-mini"
      }
    });

  } catch (error) {
    console.error('Erreur statut assistant:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification du statut'
    });
  }
});

// POST /api/assistant/toggle - Activer/désactiver l'assistant (admins uniquement)
router.post('/toggle', async (req, res) => {
  try {
    const { type: userType, decoded } = req.user;
    const { enabled } = req.body;
    
    // Seuls les admins peuvent activer/désactiver l'assistant
    if (userType !== 'user' || decoded.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Seuls les administrateurs peuvent modifier ce paramètre'
      });
    }

    // Ici vous pourriez ajouter la logique pour persister ce paramètre en base
    // Pour l'instant, on peut juste retourner l'état
    
    res.json({
      success: true,
      data: {
        enabled: enabled === true,
        message: enabled ? 'Assistant activé' : 'Assistant désactivé'
      }
    });

  } catch (error) {
    console.error('Erreur toggle assistant:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la modification du statut'
    });
  }
});

module.exports = router;