const { query } = require('../utils/auth');
const bcrypt = require('bcryptjs');

// GET /api/client/factures - Mes factures (statuts autorisés uniquement)
const getMyInvoices = async (req, res) => {
  try {
    const clientId = req.user.id; // ID du client connecté
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 10));
    const search = String(req.query.search || '').trim();
    const statut = String(req.query.statut || '').trim();
    const dateDebut = req.query.dateDebut || null;
    const dateFin = req.query.dateFin || null;
    
    const offset = (page - 1) * limit;
    
    // Construction des conditions WHERE
    let whereConditions = [
      'f.client_id = ?',
      "f.statut IN ('envoyee', 'payee', 'en_retard')" // Statuts autorisés pour le client
    ];
    let queryParams = [clientId];
    
    if (search) {
      whereConditions.push('f.numero_facture LIKE ?');
      queryParams.push(`%${search}%`);
    }
    
    if (statut && ['envoyee', 'payee', 'en_retard'].includes(statut)) {
      whereConditions.push('f.statut = ?');
      queryParams.push(statut);
    }
    
    if (dateDebut) {
      whereConditions.push('f.date_facture >= ?');
      queryParams.push(dateDebut);
    }
    
    if (dateFin) {
      whereConditions.push('f.date_facture <= ?');
      queryParams.push(dateFin);
    }
    
    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    
    // Compter le total
    const [countResult] = await query(`
      SELECT COUNT(*) as total 
      FROM factures f
      ${whereClause}
    `, queryParams);
    
    const total = countResult.total;
    
    // Récupérer les factures avec pagination
    const facturesQuery = `
      SELECT 
        f.id,
        f.numero_facture,
        f.date_facture,
        f.date_echeance,
        f.montant_ht,
        f.montant_tva,
        f.montant_ttc,
        f.statut,
        f.type_facture,
        f.message_client,
        f.date_paiement,
        f.mode_paiement,
        f.reference_paiement,
        f.date_creation
      FROM factures f
      ${whereClause}
      ORDER BY f.date_facture DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    const factures = await query(facturesQuery, queryParams);
    
    res.json({
      success: true,
      data: {
        factures,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Erreur récupération factures client:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des factures'
    });
  }
};

// GET /api/client/factures/:id - Détail d'une de mes factures
const getMyInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.user.id;
    
    // Récupérer la facture avec vérification propriétaire
    const factures = await query(`
      SELECT 
        f.*,
        c.code_client,
        c.nom as client_nom,
        c.prenom as client_prenom,
        c.entreprise,
        c.email as client_email,
        c.telephone as client_telephone,
        c.adresse as client_adresse,
        c.ville as client_ville,
        c.pays as client_pays
      FROM factures f
      LEFT JOIN clients c ON f.client_id = c.id
      WHERE f.id = ? 
      AND f.client_id = ? 
      AND f.statut IN ('envoyee', 'payee', 'en_retard')
    `, [id, clientId]);
    
    if (factures.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Facture introuvable ou non accessible'
      });
    }
    
    // Récupérer les lignes de la facture
    const lignes = await query(`
      SELECT * FROM lignes_factures 
      WHERE facture_id = ? 
      ORDER BY ordre_affichage ASC
    `, [id]);
    
    const facture = {
      ...factures[0],
      lignes
    };
    
    res.json({
      success: true,
      data: facture
    });

  } catch (error) {
    console.error('Erreur récupération facture client:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération de la facture'
    });
  }
};

// GET /api/client/factures/:id/pdf - PDF de ma facture
const downloadMyInvoicePDF = async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.user.id;
    
    // Vérifier que la facture appartient au client
    const factures = await query(`
      SELECT f.*, c.*
      FROM factures f
      LEFT JOIN clients c ON f.client_id = c.id
      WHERE f.id = ? 
      AND f.client_id = ? 
      AND f.statut IN ('envoyee', 'payee', 'en_retard')
    `, [id, clientId]);

    if (factures.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Facture introuvable ou non accessible'
      });
    }

    // Récupérer les lignes
    const lignes = await query(`
      SELECT * FROM lignes_factures 
      WHERE facture_id = ? 
      ORDER BY ordre_affichage ASC
    `, [id]);

    const facture = {
      ...factures[0],
      lignes: lignes || []
    };

    // Générer le PDF 
    const { generateInvoicePDF } = require('../config/pdfGenerator');
    const pdfBuffer = await generateInvoicePDF(facture);

    // Configurer les headers de réponse
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="facture-${facture.numero_facture}.pdf"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    // Envoyer le PDF
    res.end(pdfBuffer);

  } catch (error) {
    console.error('Erreur génération PDF client:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du PDF'
    });
  }
};

// GET /api/client/profile - Mon profil
const getMyProfile = async (req, res) => {
  try {
    const clientId = req.user.id;
    
    const clients = await query(`
      SELECT 
        id, code_client, nom, prenom, entreprise, email, 
        telephone, adresse, ville, pays, type_client, statut,
        modification_en_attente, modification_demandee_le,
        mot_de_passe_demande_le,
        date_creation, date_modification, derniere_connexion
      FROM clients 
      WHERE id = ?
    `, [clientId]);
    
    if (clients.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Profil introuvable'
      });
    }
    
    const client = clients[0];
    
    // Masquer les informations sensibles mais indiquer s'il y a des demandes en attente
    const profile = {
      ...client,
      has_modification_pending: !!client.modification_en_attente,
      has_password_change_pending: !!client.mot_de_passe_demande_le,
      modification_en_attente: undefined, // Ne pas exposer les détails
      nouveau_mot_de_passe_attente: undefined
    };
    
    res.json({
      success: true,
      data: profile
    });

  } catch (error) {
    console.error('Erreur récupération profil client:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération du profil'
    });
  }
};

// PUT /api/client/profile - Demander modification de profil
const requestProfileUpdate = async (req, res) => {
  try {
    const clientId = req.user.id;
    const {
      nom,
      prenom,
      telephone,
      adresse,
      ville,
      pays
    } = req.body;

    // Validation des champs obligatoires
    if (!nom || !prenom) {
      return res.status(400).json({
        success: false,
        message: 'Le nom et prénom sont obligatoires'
      });
    }

    // Vérifier qu'il n'y a pas déjà une demande en attente
    const existingRequest = await query(
      'SELECT modification_en_attente FROM clients WHERE id = ?',
      [clientId]
    );

    if (existingRequest[0]?.modification_en_attente) {
      return res.status(400).json({
        success: false,
        message: 'Vous avez déjà une demande de modification en attente'
      });
    }

    // Préparer les nouvelles données
    const nouvellesDonnees = {
      nom,
      prenom,
      telephone: telephone || null,
      adresse: adresse || null,
      ville: ville || 'Yaoundé',
      pays: pays || 'Cameroun'
    };

    // Sauvegarder la demande
    await query(`
      UPDATE clients SET 
        modification_en_attente = ?,
        modification_demandee_le = NOW()
      WHERE id = ?
    `, [JSON.stringify(nouvellesDonnees), clientId]);

    // Log de l'action
    await query(`
      INSERT INTO historique_actions (
        client_id, user_type, action, table_concernee, 
        enregistrement_id, nouvelles_valeurs, ip_address
      ) VALUES (?, 'client', 'REQUEST_PROFILE_UPDATE', 'clients', ?, ?, ?)
    `, [
      clientId, 
      clientId, 
      JSON.stringify(nouvellesDonnees),
      req.ip
    ]);

    res.json({
      success: true,
      message: 'Demande de modification envoyée. Elle sera examinée par un administrateur.'
    });

  } catch (error) {
    console.error('Erreur demande modification profil:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la demande de modification'
    });
  }
};

// PUT /api/client/password - Demander changement de mot de passe
const requestPasswordChange = async (req, res) => {
  try {
    const clientId = req.user.id;
    const { nouveau_mot_de_passe, mot_de_passe_actuel } = req.body;

    // Validation
    if (!nouveau_mot_de_passe || !mot_de_passe_actuel) {
      return res.status(400).json({
        success: false,
        message: 'Mot de passe actuel et nouveau mot de passe requis'
      });
    }

    if (nouveau_mot_de_passe.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Le nouveau mot de passe doit contenir au moins 6 caractères'
      });
    }

    // Vérifier le mot de passe actuel
    const clients = await query(
      'SELECT mot_de_passe, nouveau_mot_de_passe_attente FROM clients WHERE id = ?',
      [clientId]
    );

    if (clients.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client introuvable'
      });
    }

    const client = clients[0];

    // Vérifier qu'il n'y a pas déjà une demande en attente
    if (client.nouveau_mot_de_passe_attente) {
      return res.status(400).json({
        success: false,
        message: 'Vous avez déjà une demande de changement de mot de passe en attente'
      });
    }

    // Vérifier le mot de passe actuel
    const isValidPassword = await bcrypt.compare(mot_de_passe_actuel, client.mot_de_passe);
    
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        message: 'Mot de passe actuel incorrect'
      });
    }

    // Hacher le nouveau mot de passe
    const hashedNewPassword = await bcrypt.hash(nouveau_mot_de_passe, 12);

    // Sauvegarder la demande
    await query(`
      UPDATE clients SET 
        nouveau_mot_de_passe_attente = ?,
        mot_de_passe_demande_le = NOW()
      WHERE id = ?
    `, [hashedNewPassword, clientId]);

    // Log de l'action
    await query(`
      INSERT INTO historique_actions (
        client_id, user_type, action, table_concernee, 
        enregistrement_id, nouvelles_valeurs, ip_address
      ) VALUES (?, 'client', 'REQUEST_PASSWORD_CHANGE', 'clients', ?, ?, ?)
    `, [
      clientId, 
      clientId, 
      JSON.stringify({ action: 'Demande changement mot de passe' }),
      req.ip
    ]);

    res.json({
      success: true,
      message: 'Demande de changement de mot de passe envoyée. Elle sera examinée par un administrateur.'
    });

  } catch (error) {
    console.error('Erreur demande changement mot de passe:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la demande de changement'
    });
  }
};

// GET /api/client/stats - Mes statistiques
const getMyStats = async (req, res) => {
  try {
    const clientId = req.user.id;
    
    const stats = await query(`
      SELECT 
        COUNT(*) as total_factures,
        COUNT(CASE WHEN statut = 'envoyee' THEN 1 END) as factures_en_attente,
        COUNT(CASE WHEN statut = 'payee' THEN 1 END) as factures_payees,
        COUNT(CASE WHEN statut = 'en_retard' THEN 1 END) as factures_en_retard,
        COALESCE(SUM(CASE WHEN statut = 'payee' THEN montant_ttc ELSE 0 END), 0) as montant_paye,
        COALESCE(SUM(CASE WHEN statut IN ('envoyee', 'en_retard') THEN montant_ttc ELSE 0 END), 0) as montant_en_attente,
        COALESCE(SUM(montant_ttc), 0) as montant_total,
        COUNT(CASE WHEN DATE(date_creation) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 END) as factures_mois_dernier
      FROM factures 
      WHERE client_id = ? 
      AND statut IN ('envoyee', 'payee', 'en_retard')
    `, [clientId]);

    res.json({
      success: true,
      data: stats[0]
    });

  } catch (error) {
    console.error('Erreur statistiques client:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des statistiques'
    });
  }
};

// GET /api/client/notifications - Mes notifications
const getMyNotifications = async (req, res) => {
  try {
    const clientId = req.user.id;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 10));
    const offset = (page - 1) * limit;
    
    // Compter le total
    const [countResult] = await query(
      'SELECT COUNT(*) as total FROM notifications_client WHERE client_id = ?',
      [clientId]
    );
    
    // Récupérer les notifications
    const notifications = await query(`
      SELECT 
        id, type, titre, message, lu, date_creation
      FROM notifications_client 
      WHERE client_id = ?
      ORDER BY date_creation DESC
      LIMIT ${limit} OFFSET ${offset}
    `, [clientId]);
    
    // Compter les non lues
    const [unreadResult] = await query(
      'SELECT COUNT(*) as unread FROM notifications_client WHERE client_id = ? AND lu = FALSE',
      [clientId]
    );
    
    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          page,
          limit,
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / limit)
        },
        unread_count: unreadResult.unread
      }
    });

  } catch (error) {
    console.error('Erreur notifications client:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des notifications'
    });
  }
};

// PUT /api/client/notifications/:id/read - Marquer notification comme lue
const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.user.id;
    
    await query(
      'UPDATE notifications_client SET lu = TRUE WHERE id = ? AND client_id = ?',
      [id, clientId]
    );
    
    res.json({
      success: true,
      message: 'Notification marquée comme lue'
    });

  } catch (error) {
    console.error('Erreur marquer notification lue:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

module.exports = {
  getMyInvoices,
  getMyInvoiceById,
  downloadMyInvoicePDF,
  getMyProfile,
  requestProfileUpdate,
  requestPasswordChange,
  getMyStats,
  getMyNotifications,
  markNotificationAsRead
};