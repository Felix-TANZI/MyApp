const { query } = require('../utils/auth');

// GET /api/admin/requests - Liste des demandes en attente
const getPendingRequests = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 20));
    const type = req.query.type || ''; // modification_profil ou changement_mot_de_passe
    const offset = (page - 1) * limit;
    
    let whereClause = '';
    let queryParams = [];
    
    if (type && ['modification_profil', 'changement_mot_de_passe'].includes(type)) {
      if (type === 'modification_profil') {
        whereClause = 'WHERE c.modification_en_attente IS NOT NULL';
      } else {
        whereClause = 'WHERE c.nouveau_mot_de_passe_attente IS NOT NULL';
      }
    } else {
      whereClause = 'WHERE (c.modification_en_attente IS NOT NULL OR c.nouveau_mot_de_passe_attente IS NOT NULL)';
    }
    
    // Compter le total
    const [countResult] = await query(`
      SELECT COUNT(*) as total 
      FROM clients c
      ${whereClause}
    `, queryParams);
    
    // Récupérer les demandes
    const requests = await query(`
      SELECT 
        c.id,
        c.code_client,
        c.nom,
        c.prenom,
        c.entreprise,
        c.email,
        c.telephone,
        c.adresse,
        c.ville,
        c.pays,
        c.type_client,
        c.modification_en_attente,
        c.modification_demandee_le,
        c.nouveau_mot_de_passe_attente,
        c.mot_de_passe_demande_le,
        c.derniere_connexion,
        c.date_creation,
        CASE 
          WHEN c.modification_en_attente IS NOT NULL THEN 'modification_profil'
          WHEN c.nouveau_mot_de_passe_attente IS NOT NULL THEN 'changement_mot_de_passe'
          ELSE NULL
        END as type_demande,
        CASE 
          WHEN c.modification_en_attente IS NOT NULL THEN c.modification_demandee_le
          WHEN c.nouveau_mot_de_passe_attente IS NOT NULL THEN c.mot_de_passe_demande_le
          ELSE NULL
        END as date_demande
      FROM clients c
      ${whereClause}
      ORDER BY 
        CASE 
          WHEN c.modification_en_attente IS NOT NULL THEN c.modification_demandee_le
          WHEN c.nouveau_mot_de_passe_attente IS NOT NULL THEN c.mot_de_passe_demande_le
          ELSE NULL
        END DESC
      LIMIT ${limit} OFFSET ${offset}
    `, queryParams);
    
    // Compter par type
    const statsRequests = await query(`
      SELECT 
        COUNT(CASE WHEN modification_en_attente IS NOT NULL THEN 1 END) as modifications_profil,
        COUNT(CASE WHEN nouveau_mot_de_passe_attente IS NOT NULL THEN 1 END) as changements_mot_de_passe,
        COUNT(*) as total
      FROM clients 
      WHERE (modification_en_attente IS NOT NULL OR nouveau_mot_de_passe_attente IS NOT NULL)
    `);
    
    res.json({
      success: true,
      data: {
        requests,
        pagination: {
          page,
          limit,
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / limit),
          hasNext: page < Math.ceil(countResult.total / limit),
          hasPrev: page > 1
        },
        stats: statsRequests[0]
      }
    });

  } catch (error) {
    console.error('Erreur récupération demandes:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des demandes'
    });
  }
};

// POST /api/admin/requests/:id/approve-profile - Approuver modification profil
const approveProfileUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    
    // Récupérer les données en attente
    const clients = await query(
      'SELECT * FROM clients WHERE id = ? AND modification_en_attente IS NOT NULL',
      [id]
    );
    
    if (clients.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Aucune demande de modification trouvée pour ce client'
      });
    }
    
    const client = clients[0];
    const nouvellesDonnees = JSON.parse(client.modification_en_attente);
    
    // Sauvegarder les anciennes données pour l'historique
    const anciennesDonnees = {
      nom: client.nom,
      prenom: client.prenom,
      telephone: client.telephone,
      adresse: client.adresse,
      ville: client.ville,
      pays: client.pays
    };
    
    // Appliquer les modifications
    await query(`
      UPDATE clients SET 
        nom = ?,
        prenom = ?,
        telephone = ?,
        adresse = ?,
        ville = ?,
        pays = ?,
        modification_en_attente = NULL,
        modification_demandee_le = NULL,
        date_modification = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      nouvellesDonnees.nom,
      nouvellesDonnees.prenom,
      nouvellesDonnees.telephone,
      nouvellesDonnees.adresse,
      nouvellesDonnees.ville,
      nouvellesDonnees.pays,
      id
    ]);
    
    // Créer une notification pour le client
    await query(`
      INSERT INTO notifications_client (client_id, type, titre, message)
      VALUES (?, 'modification_approuvee', 'Modification approuvée', 'Vos modifications de profil ont été approuvées et appliquées.')
    `, [id]);
    
    // Log de l'action dans l'historique
    await query(`
      INSERT INTO historique_actions (
        user_id, user_type, action, table_concernee, 
        enregistrement_id, anciennes_valeurs, nouvelles_valeurs, ip_address
      ) VALUES (?, 'user', 'APPROVE_PROFILE_UPDATE', 'clients', ?, ?, ?, ?)
    `, [
      adminId, 
      id,
      JSON.stringify(anciennesDonnees),
      JSON.stringify(nouvellesDonnees),
      req.ip
    ]);
    
    res.json({
      success: true,
      message: 'Modification de profil approuvée et appliquée'
    });

  } catch (error) {
    console.error('Erreur approbation modification profil:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de l\'approbation'
    });
  }
};

// POST /api/admin/requests/:id/reject-profile - Rejeter modification profil
const rejectProfileUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const { motif } = req.body;
    const adminId = req.user.id;
    
    // Vérifier qu'il y a une demande
    const clients = await query(
      'SELECT modification_en_attente FROM clients WHERE id = ? AND modification_en_attente IS NOT NULL',
      [id]
    );
    
    if (clients.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Aucune demande de modification trouvée pour ce client'
      });
    }
    
    // Supprimer la demande
    await query(`
      UPDATE clients SET 
        modification_en_attente = NULL,
        modification_demandee_le = NULL
      WHERE id = ?
    `, [id]);
    
    // Créer une notification pour le client
    const message = motif 
      ? `Votre demande de modification de profil a été rejetée. Motif: ${motif}`
      : 'Votre demande de modification de profil a été rejetée.';
    
    await query(`
      INSERT INTO notifications_client (client_id, type, titre, message)
      VALUES (?, 'modification_rejetee', 'Modification rejetée', ?)
    `, [id, message]);
    
    // Log de l'action
    await query(`
      INSERT INTO historique_actions (
        user_id, user_type, action, table_concernee, 
        enregistrement_id, nouvelles_valeurs, ip_address
      ) VALUES (?, 'user', 'REJECT_PROFILE_UPDATE', 'clients', ?, ?, ?)
    `, [
      adminId, 
      id,
      JSON.stringify({ motif: motif || 'Aucun motif spécifié' }),
      req.ip
    ]);
    
    res.json({
      success: true,
      message: 'Demande de modification rejetée'
    });

  } catch (error) {
    console.error('Erreur rejet modification profil:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors du rejet'
    });
  }
};

// POST /api/admin/requests/:id/approve-password - Approuver changement mot de passe
const approvePasswordChange = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    
    // Récupérer le nouveau mot de passe en attente
    const clients = await query(
      'SELECT nouveau_mot_de_passe_attente FROM clients WHERE id = ? AND nouveau_mot_de_passe_attente IS NOT NULL',
      [id]
    );
    
    if (clients.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Aucune demande de changement de mot de passe trouvée pour ce client'
      });
    }
    
    const nouveauMotDePasse = clients[0].nouveau_mot_de_passe_attente;
    
    // Appliquer le changement
    await query(`
      UPDATE clients SET 
        mot_de_passe = ?,
        nouveau_mot_de_passe_attente = NULL,
        mot_de_passe_demande_le = NULL,
        date_modification = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [nouveauMotDePasse, id]);
    
    // Créer une notification pour le client
    await query(`
      INSERT INTO notifications_client (client_id, type, titre, message)
      VALUES (?, 'mot_de_passe_approuve', 'Mot de passe modifié', 'Votre nouveau mot de passe a été approuvé et est maintenant actif.')
    `, [id]);
    
    // Log de l'action
    await query(`
      INSERT INTO historique_actions (
        user_id, user_type, action, table_concernee, 
        enregistrement_id, nouvelles_valeurs, ip_address
      ) VALUES (?, 'user', 'APPROVE_PASSWORD_CHANGE', 'clients', ?, ?, ?)
    `, [
      adminId, 
      id,
      JSON.stringify({ action: 'Changement mot de passe approuvé' }),
      req.ip
    ]);
    
    res.json({
      success: true,
      message: 'Changement de mot de passe approuvé et appliqué'
    });

  } catch (error) {
    console.error('Erreur approbation changement mot de passe:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de l\'approbation'
    });
  }
};

// POST /api/admin/requests/:id/reject-password - Rejeter changement mot de passe
const rejectPasswordChange = async (req, res) => {
  try {
    const { id } = req.params;
    const { motif } = req.body;
    const adminId = req.user.id;
    
    // Vérifier qu'il y a une demande
    const clients = await query(
      'SELECT nouveau_mot_de_passe_attente FROM clients WHERE id = ? AND nouveau_mot_de_passe_attente IS NOT NULL',
      [id]
    );
    
    if (clients.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Aucune demande de changement de mot de passe trouvée pour ce client'
      });
    }
    
    // Supprimer la demande
    await query(`
      UPDATE clients SET 
        nouveau_mot_de_passe_attente = NULL,
        mot_de_passe_demande_le = NULL
      WHERE id = ?
    `, [id]);
    
    // Créer une notification pour le client
    const message = motif 
      ? `Votre demande de changement de mot de passe a été rejetée. Motif: ${motif}`
      : 'Votre demande de changement de mot de passe a été rejetée.';
    
    await query(`
      INSERT INTO notifications_client (client_id, type, titre, message)
      VALUES (?, 'mot_de_passe_rejete', 'Changement rejeté', ?)
    `, [id, message]);
    
    // Log de l'action
    await query(`
      INSERT INTO historique_actions (
        user_id, user_type, action, table_concernee, 
        enregistrement_id, nouvelles_valeurs, ip_address
      ) VALUES (?, 'user', 'REJECT_PASSWORD_CHANGE', 'clients', ?, ?, ?)
    `, [
      adminId, 
      id,
      JSON.stringify({ motif: motif || 'Aucun motif spécifié' }),
      req.ip
    ]);
    
    res.json({
      success: true,
      message: 'Demande de changement de mot de passe rejetée'
    });

  } catch (error) {
    console.error('Erreur rejet changement mot de passe:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors du rejet'
    });
  }
};

// GET /api/admin/requests/stats - Statistiques des demandes
const getRequestsStats = async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(CASE WHEN modification_en_attente IS NOT NULL THEN 1 END) as demandes_profil,
        COUNT(CASE WHEN nouveau_mot_de_passe_attente IS NOT NULL THEN 1 END) as demandes_mot_de_passe,
        COUNT(CASE WHEN (modification_en_attente IS NOT NULL OR nouveau_mot_de_passe_attente IS NOT NULL) THEN 1 END) as total_demandes,
        COUNT(CASE WHEN modification_demandee_le >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as demandes_24h,
        COUNT(CASE WHEN mot_de_passe_demande_le >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as demandes_password_24h
      FROM clients
    `);
    
    res.json({
      success: true,
      data: stats[0]
    });

  } catch (error) {
    console.error('Erreur statistiques demandes:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des statistiques'
    });
  }
};

// Fonction utilitaire pour notifier un client
const notifyClient = async (clientId, type, titre, message) => {
  try {
    await query(`
      INSERT INTO notifications_client (client_id, type, titre, message)
      VALUES (?, ?, ?, ?)
    `, [clientId, type, titre, message]);
  } catch (error) {
    console.error('Erreur création notification:', error);
  }
};

module.exports = {
  getPendingRequests,
  approveProfileUpdate,
  rejectProfileUpdate,
  approvePasswordChange,
  rejectPasswordChange,
  getRequestsStats,
  notifyClient
};