// MIDDLEWARE DE PERMISSIONS RÉUTILISABLE
// Ici nous ajouteront facilement des droits spécifiques par la suite (Differente mise a jour)

const { query } = require('../utils/auth');

// Fonction utilitaire pour vérifier les permissions spécifiques
async function hasSpecificPermission(userId, permissionName) {
  try {
    const permissions = await query(`
      SELECT * FROM user_permissions 
      WHERE user_id = ? 
      AND permission_name = ? 
      AND is_active = TRUE 
      AND (date_expires IS NULL OR date_expires > NOW())
    `, [userId, permissionName]);
    
    return permissions.length > 0;
  } catch (error) {
    console.error('Erreur vérification permission:', error);
    return false;
  }
}

// Middleware de base pour vérifier l'authentification
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentification requise'
    });
  }
  next();
};

// Middleware pour vérifier le rôle (admin, commercial, comptable)
const requireRole = (roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentification requise'
        });
      }

      // Récupérer les infos utilisateur depuis la base
      const users = await query(
        'SELECT id, nom, prenom, role FROM users WHERE id = ?',
        [req.user.id]
      );

      if (users.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Utilisateur invalide'
        });
      }

      const user = users[0];
      req.userRole = user.role;
      req.userInfo = user;

      // Vérifier si l'utilisateur a le rôle requis
      const rolesArray = Array.isArray(roles) ? roles : [roles];
      
      if (!rolesArray.includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Permissions insuffisantes'
        });
      }

      next();
    } catch (error) {
      console.error('Erreur middleware role:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  };
};

// Middleware pour les actions sur les factures
const canManageInvoices = requireRole(['admin', 'commercial', 'comptable']);

// Middleware pour vérifier si l'utilisateur peut supprimer une facture spécifique
const canDeleteInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // L'admin peut tout supprimer, ou vérifier permission spécifique
    if (req.userRole === 'admin' || await hasSpecificPermission(userId, 'can_delete_all_invoices')) {
      return next();
    }

    // Vérifier si c'est le créateur de la facture
    const invoices = await query(
      'SELECT user_id FROM factures WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    if (invoices.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Facture introuvable'
      });
    }

    if (invoices[0].user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez supprimer que vos propres factures'
      });
    }

    next();
  } catch (error) {
    console.error('Erreur permission suppression facture:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// Middleware pour vérifier si l'utilisateur peut modifier une facture
const canModifyInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // L'admin peut tout modifier
    if (req.userRole === 'admin' || await hasSpecificPermission(userId, 'can_modify_all_invoices')) {
      return next();
    }

    // Vérifier si c'est le créateur de la facture
    const invoices = await query(
      'SELECT user_id, statut FROM factures WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    if (invoices.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Facture introuvable'
      });
    }

    const invoice = invoices[0];

    if (invoice.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez modifier que vos propres factures'
      });
    }

    // Empêcher la modification des factures payées (sauf permission spéciale)
    if (invoice.statut === 'payee' && !await hasSpecificPermission(userId, 'can_modify_paid_invoices')) {
      return res.status(403).json({
        success: false,
        message: 'Impossible de modifier une facture payée'
      });
    }

    next();
  } catch (error) {
    console.error('Erreur permission modification facture:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// Middleware pour les actions sur les clients
const canManageClients = requireRole(['admin', 'commercial', 'comptable']);

// Middleware pour vérifier les permissions de paiement
const canManagePayments = requireRole(['admin', 'comptable', 'commercial']);

// Middleware pour les actions admin uniquement
const requireAdmin = requireRole(['admin']);

// Fonction utilitaire pour accorder une permission spécifique
const grantPermission = async (userId, permissionName, grantedBy, expiresAt = null) => {
  try {
    await query(`
      INSERT INTO user_permissions (user_id, permission_name, granted_by, date_expires)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
      granted_by = VALUES(granted_by),
      date_expires = VALUES(date_expires),
      is_active = TRUE,
      date_granted = CURRENT_TIMESTAMP
    `, [userId, permissionName, grantedBy, expiresAt]);
    
    return true;
  } catch (error) {
    console.error('Erreur octroi permission:', error);
    return false;
  }
};

// Fonction utilitaire pour révoquer une permission
const revokePermission = async (userId, permissionName) => {
  try {
    await query(
      'UPDATE user_permissions SET is_active = FALSE WHERE user_id = ? AND permission_name = ?',
      [userId, permissionName]
    );
    return true;
  } catch (error) {
    console.error('Erreur révocation permission:', error);
    return false;
  }
};

module.exports = {
  requireAuth,
  requireRole,
  requireAdmin,
  canManageInvoices,
  canDeleteInvoice,
  canModifyInvoice,
  canManageClients,
  canManagePayments,
  hasSpecificPermission,
  grantPermission,
  revokePermission
};