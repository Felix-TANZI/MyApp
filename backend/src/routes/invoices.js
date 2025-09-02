const express = require('express');
const rateLimit = require('express-rate-limit');
const { verifyAuth } = require('../controllers/authController');
const { 
  requireAuth, 
  canManageInvoices,
  canModifyInvoice,
  canDeleteInvoice 
} = require('../middleware/permissions');

const {
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  changeInvoiceStatus,
  getInvoicesStats,
  generateInvoicePDF,
  duplicateInvoice
} = require('../controllers/invoicesController');

const router = express.Router();

// Rate limiting pour les actions de création/modification
const modifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes par IP (plus élevé que clients car plus d'actions)
  message: {
    success: false,
    message: 'Trop de requêtes de modification. Réessayez dans 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

// Rate limiting pour la génération PDF
const pdfLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 PDF par IP
  message: {
    success: false,
    message: 'Trop de demandes de PDF. Réessayez dans 5 minutes.'
  }
});

// Middleware d'authentification pour toutes les routes
router.use(verifyAuth);
router.use(requireAuth);
router.use(canManageInvoices);

// GET /api/invoices - Liste des factures avec pagination et filtres
router.get('/', getInvoices);

// GET /api/invoices/stats - Statistiques des factures
router.get('/stats', getInvoicesStats);

// GET /api/invoices/:id - Récupérer une facture spécifique avec ses lignes
router.get('/:id', getInvoiceById);

// GET /api/invoices/:id/pdf - Générer et télécharger le PDF
router.get('/:id/pdf', pdfLimiter, generateInvoicePDF);

// POST /api/invoices - Créer une nouvelle facture
router.post('/', modifyLimiter, createInvoice);

// POST /api/invoices/:id/duplicate - Dupliquer une facture
router.post('/:id/duplicate', modifyLimiter, duplicateInvoice);

// POST /api/invoices/:id/status - Changer le statut d'une facture
router.post('/:id/status', modifyLimiter, changeInvoiceStatus);

// PUT /api/invoices/:id - Modifier une facture
router.put('/:id', modifyLimiter, canModifyInvoice, updateInvoice);

// DELETE /api/invoices/:id - Supprimer une facture
router.delete('/:id', modifyLimiter, canDeleteInvoice, deleteInvoice);

module.exports = router;