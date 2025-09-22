const { query } = require('../utils/auth');

// Fonction utilitaire pour vérifier les permissions
const checkRequestPermissions = async (userId, userRole, clientId) => {
  // Les admins ont toujours accès
  if (userRole === 'admin') {
    return true;
  }

  // Vérifier si l'utilisateur est le créateur du client
  const clients = await query(
    'SELECT created_by FROM clients WHERE id = ?',
    [clientId]
  );

  if (clients.length === 0) {
    return false;
  }

  return clients[0].created_by === userId;
};

// GET /api/requests - Liste des demandes en attente
const getPendingRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 20));
    const type = req.query.type || ''; // modification_profil ou changement_mot_de_passe
    const clientId = req.query.client_id || null; // Filtrer par client spécifique
    const offset = (page - 1) * limit;
    
    let whereConditions = [];
    let queryParams = [];
    
    // Construire les conditions WHERE
    let baseWhere = '(c.modification_en_attente IS NOT NULL OR c.nouveau_mot_de_passe_attente IS NOT NULL)';
    
    if (type && ['modification_profil', 'changement_mot_de_passe'].includes(type)) {
      if (type === 'modification_profil') {
        baseWhere = 'c.modification_en_attente IS NOT NULL';
      } else {
        baseWhere = 'c.nouveau_mot_de_passe_attente IS NOT NULL';
      }
    }
    
    whereConditions.push(baseWhere);
    
    // Filtrer par client spécifique si demandé
    if (clientId) {
      whereConditions.push('c.id = ?');
      queryParams.push(clientId);
    }
    
    // Filtrer selon les permissions (non-admin ne voient que leurs clients créés)
    if (userRole !== 'admin') {
      whereConditions.push('c.created_by = ?');
      queryParams.push(userId);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Compter le total
    const [countResult] = await query(`
      SELECT COUNT(*) as total 
      FROM clients c
      ${whereClause}
    `, queryParams);
    
    // Récupérer les demandes avec informations complètes
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
        c.created_by,
        u.nom as creator_nom,
        u.prenom as creator_prenom,
        u.role as creator_role,
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
      LEFT JOIN users u ON c.created_by = u.id
      ${whereClause}
      ORDER BY 
        CASE 
          WHEN c.modification_en_attente IS NOT NULL THEN c.modification_demandee_le
          WHEN c.nouveau_mot_de_passe_attente IS NOT NULL THEN c.mot_de_passe_demande_le
          ELSE NULL
        END DESC
      LIMIT ${limit} OFFSET ${offset}
    `, queryParams);
    
    // Compter par type avec permissions
    const statsRequests = await query(`
      SELECT 
        COUNT(CASE WHEN modification_en_attente IS NOT NULL THEN 1 END) as modifications_profil,
        COUNT(CASE WHEN nouveau_mot_de_passe_attente IS NOT NULL THEN 1 END) as changements_mot_de_passe,
        COUNT(*) as total
      FROM clients c
      WHERE (modification_en_attente IS NOT NULL OR nouveau_mot_de_passe_attente IS NOT NULL)
      ${userRole !== 'admin' ? 'AND c.created_by = ?' : ''}
    `, userRole !== 'admin' ? [userId] : []);
    
    // Traiter les demandes pour inclure les détails des modifications
    const processedRequests = requests.map(request => {
      let modification_details = null;
      
      if (request.modification_en_attente) {
        try {
          modification_details = JSON.parse(request.modification_en_attente);
        } catch (e) {
          console.error('Erreur parsing modification_en_attente:', e);
        }
      }
      
      return {
        ...request,
        modification_details,
        // Masquer les données sensibles
        modification_en_attente: undefined,
        nouveau_mot_de_passe_attente: undefined,
        // Ajouter des indicateurs utiles
        has_password_request: !!request.nouveau_mot_de_passe_attente,
        can_approve: true, // L'utilisateur peut voir = peut approuver
        urgency: calculateUrgency(request.date_demande)
      };
    });
    
    res.json({
      success: true,
      data: {
        requests: processedRequests,
        pagination: {
          page,
          limit,
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / limit),
          hasNext: page < Math.ceil(countResult.total / limit),
          hasPrev: page > 1
        },
        stats: statsRequests[0],
        filters: {
          type: type || 'all',
          client_id: clientId || null,
          user_role: userRole,
          permissions: userRole === 'admin' ? 'full' : 'created_clients_only'
        }
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

// POST /api/requests/:id/approve-profile - Approuver modification profil
const approveProfileUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Vérifier les permissions
    const hasPermission = await checkRequestPermissions(userId, userRole, id);
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'avez pas les permissions pour traiter cette demande'
      });
    }
    
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
    
    // Créer une notification pour le client via WebSocket
    try {
      const notificationData = {
        type: 'modification_approuvee',
        titre: 'Modification approuvée',
        message: 'Vos modifications de profil ont été approuvées et appliquées.',
        data: {
          approved_by: userId,
          applied_changes: nouvellesDonnees
        }
      };

      if (req.notificationService) {
        await req.notificationService.createAndSendNotification('client', id, notificationData);
        console.log(`🔔 Notification d'approbation envoyée au client ${id}`);
      }
    } catch (notifError) {
      console.error('Erreur notification approbation:', notifError);
    }
    
    // Log de l'action dans l'historique
    await query(`
      INSERT INTO historique_actions (
        user_id, user_type, action, table_concernee, 
        enregistrement_id, anciennes_valeurs, nouvelles_valeurs, ip_address
      ) VALUES (?, 'user', 'APPROVE_PROFILE_UPDATE', 'clients', ?, ?, ?, ?)
    `, [
      userId, 
      id,
      JSON.stringify(anciennesDonnees),
      JSON.stringify(nouvellesDonnees),
      req.ip
    ]);
    
    res.json({
      success: true,
      message: 'Modification de profil approuvée et appliquée',
      data: {
        client_id: id,
        approved_by: userId,
        changes_applied: nouvellesDonnees
      }
    });

  } catch (error) {
    console.error('Erreur approbation modification profil:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de l\'approbation'
    });
  }
};

// POST /api/requests/:id/reject-profile - Rejeter modification profil
const rejectProfileUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const { motif } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Vérifier les permissions
    const hasPermission = await checkRequestPermissions(userId, userRole, id);
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'avez pas les permissions pour traiter cette demande'
      });
    }
    
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
    
    const rejectedData = JSON.parse(clients[0].modification_en_attente);
    
    // Supprimer la demande
    await query(`
      UPDATE clients SET 
        modification_en_attente = NULL,
        modification_demandee_le = NULL
      WHERE id = ?
    `, [id]);
    
    // Créer une notification pour le client via WebSocket
    try {
      const message = motif 
        ? `Votre demande de modification de profil a été rejetée. Motif: ${motif}`
        : 'Votre demande de modification de profil a été rejetée.';
        
      const notificationData = {
        type: 'modification_rejetee',
        titre: 'Modification rejetée',
        message: message,
        data: {
          rejected_by: userId,
          rejection_reason: motif || 'Aucun motif spécifié',
          rejected_changes: rejectedData
        }
      };

      if (req.notificationService) {
        await req.notificationService.createAndSendNotification('client', id, notificationData);
        console.log(`🔔 Notification de rejet envoyée au client ${id}`);
      }
    } catch (notifError) {
      console.error('Erreur notification rejet:', notifError);
    }
    
    // Log de l'action
    await query(`
      INSERT INTO historique_actions (
        user_id, user_type, action, table_concernee, 
        enregistrement_id, nouvelles_valeurs, ip_address
      ) VALUES (?, 'user', 'REJECT_PROFILE_UPDATE', 'clients', ?, ?, ?)
    `, [
      userId, 
      id,
      JSON.stringify({ 
        motif: motif || 'Aucun motif spécifié',
        rejected_changes: rejectedData 
      }),
      req.ip
    ]);
    
    res.json({
      success: true,
      message: 'Demande de modification rejetée',
      data: {
        client_id: id,
        rejected_by: userId,
        rejection_reason: motif || 'Aucun motif spécifié'
      }
    });

  } catch (error) {
    console.error('Erreur rejet modification profil:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors du rejet'
    });
  }
};

// POST /api/requests/:id/approve-password - Approuver changement mot de passe
const approvePasswordChange = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Vérifier les permissions
    const hasPermission = await checkRequestPermissions(userId, userRole, id);
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'avez pas les permissions pour traiter cette demande'
      });
    }
    
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
    
    // Créer une notification pour le client via WebSocket
    try {
      const notificationData = {
        type: 'mot_de_passe_approuve',
        titre: 'Mot de passe modifié',
        message: 'Votre nouveau mot de passe a été approuvé et est maintenant actif.',
        data: {
          approved_by: userId,
          change_date: new Date().toISOString()
        }
      };

      if (req.notificationService) {
        await req.notificationService.createAndSendNotification('client', id, notificationData);
        console.log(`🔔 Notification d'approbation mot de passe envoyée au client ${id}`);
      }
    } catch (notifError) {
      console.error('Erreur notification approbation mot de passe:', notifError);
    }
    
    // Log de l'action
    await query(`
      INSERT INTO historique_actions (
        user_id, user_type, action, table_concernee, 
        enregistrement_id, nouvelles_valeurs, ip_address
      ) VALUES (?, 'user', 'APPROVE_PASSWORD_CHANGE', 'clients', ?, ?, ?)
    `, [
      userId, 
      id,
      JSON.stringify({ 
        action: 'Changement mot de passe approuvé',
        approved_by: userId 
      }),
      req.ip
    ]);
    
    res.json({
      success: true,
      message: 'Changement de mot de passe approuvé et appliqué',
      data: {
        client_id: id,
        approved_by: userId
      }
    });

  } catch (error) {
    console.error('Erreur approbation changement mot de passe:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de l\'approbation'
    });
  }
};

// POST /api/requests/:id/reject-password - Rejeter changement mot de passe
const rejectPasswordChange = async (req, res) => {
  try {
    const { id } = req.params;
    const { motif } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Vérifier les permissions
    const hasPermission = await checkRequestPermissions(userId, userRole, id);
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'avez pas les permissions pour traiter cette demande'
      });
    }
    
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
    
    // Créer une notification pour le client via WebSocket
    try {
      const message = motif 
        ? `Votre demande de changement de mot de passe a été rejetée. Motif: ${motif}`
        : 'Votre demande de changement de mot de passe a été rejetée.';
        
      const notificationData = {
        type: 'mot_de_passe_rejete',
        titre: 'Changement rejeté',
        message: message,
        data: {
          rejected_by: userId,
          rejection_reason: motif || 'Aucun motif spécifié'
        }
      };

      if (req.notificationService) {
        await req.notificationService.createAndSendNotification('client', id, notificationData);
        console.log(`🔔 Notification de rejet mot de passe envoyée au client ${id}`);
      }
    } catch (notifError) {
      console.error('Erreur notification rejet mot de passe:', notifError);
    }
    
    // Log de l'action
    await query(`
      INSERT INTO historique_actions (
        user_id, user_type, action, table_concernee, 
        enregistrement_id, nouvelles_valeurs, ip_address
      ) VALUES (?, 'user', 'REJECT_PASSWORD_CHANGE', 'clients', ?, ?, ?)
    `, [
      userId, 
      id,
      JSON.stringify({ 
        motif: motif || 'Aucun motif spécifié',
        rejected_by: userId 
      }),
      req.ip
    ]);
    
    res.json({
      success: true,
      message: 'Demande de changement de mot de passe rejetée',
      data: {
        client_id: id,
        rejected_by: userId,
        rejection_reason: motif || 'Aucun motif spécifié'
      }
    });

  } catch (error) {
    console.error('Erreur rejet changement mot de passe:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors du rejet'
    });
  }
};

// GET /api/requests/stats - Statistiques des demandes
const getRequestsStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Statistiques globales avec permissions
    const globalStatsQuery = `
      SELECT 
        COUNT(CASE WHEN modification_en_attente IS NOT NULL THEN 1 END) as demandes_profil,
        COUNT(CASE WHEN nouveau_mot_de_passe_attente IS NOT NULL THEN 1 END) as demandes_mot_de_passe,
        COUNT(CASE WHEN (modification_en_attente IS NOT NULL OR nouveau_mot_de_passe_attente IS NOT NULL) THEN 1 END) as total_demandes,
        COUNT(CASE WHEN modification_demandee_le >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as demandes_profil_24h,
        COUNT(CASE WHEN mot_de_passe_demande_le >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as demandes_password_24h,
        COUNT(CASE WHEN modification_demandee_le >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as demandes_profil_7j,
        COUNT(CASE WHEN mot_de_passe_demande_le >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as demandes_password_7j
      FROM clients 
      WHERE (modification_en_attente IS NOT NULL OR nouveau_mot_de_passe_attente IS NOT NULL)
      ${userRole !== 'admin' ? 'AND created_by = ?' : ''}
    `;
    
    const globalStatsParams = userRole !== 'admin' ? [userId] : [];
    const stats = await query(globalStatsQuery, globalStatsParams);
    
    // Statistiques par urgence
    const urgencyStats = await query(`
      SELECT 
        COUNT(CASE WHEN modification_demandee_le <= DATE_SUB(NOW(), INTERVAL 7 DAY) OR mot_de_passe_demande_le <= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as urgent,
        COUNT(CASE WHEN (modification_demandee_le > DATE_SUB(NOW(), INTERVAL 7 DAY) AND modification_demandee_le <= DATE_SUB(NOW(), INTERVAL 3 DAY)) OR (mot_de_passe_demande_le > DATE_SUB(NOW(), INTERVAL 7 DAY) AND mot_de_passe_demande_le <= DATE_SUB(NOW(), INTERVAL 3 DAY)) THEN 1 END) as moderee,
        COUNT(CASE WHEN modification_demandee_le > DATE_SUB(NOW(), INTERVAL 3 DAY) OR mot_de_passe_demande_le > DATE_SUB(NOW(), INTERVAL 3 DAY) THEN 1 END) as normale
      FROM clients 
      WHERE (modification_en_attente IS NOT NULL OR nouveau_mot_de_passe_attente IS NOT NULL)
      ${userRole !== 'admin' ? 'AND created_by = ?' : ''}
    `, globalStatsParams);
    
    // Top 5 des clients avec le plus de demandes (historique)
    const topClients = await query(`
      SELECT 
        c.id,
        c.code_client,
        c.nom,
        c.prenom,
        c.entreprise,
        COUNT(h.id) as nombre_demandes
      FROM clients c
      LEFT JOIN historique_actions h ON c.id = h.enregistrement_id 
        AND h.action IN ('REQUEST_PROFILE_UPDATE', 'REQUEST_PASSWORD_CHANGE')
        AND h.date_action >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      WHERE 1=1 ${userRole !== 'admin' ? 'AND c.created_by = ?' : ''}
      GROUP BY c.id, c.code_client, c.nom, c.prenom, c.entreprise
      HAVING nombre_demandes > 0
      ORDER BY nombre_demandes DESC
      LIMIT 5
    `, globalStatsParams);
    
    res.json({
      success: true,
      data: {
        global: stats[0],
        urgency: urgencyStats[0],
        top_clients: topClients,
        permissions: {
          role: userRole,
          can_see_all: userRole === 'admin',
          filtered_by_creator: userRole !== 'admin'
        }
      }
    });

  } catch (error) {
    console.error('Erreur statistiques demandes:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des statistiques'
    });
  }
};

// GET /api/requests/:id - Détail d'une demande spécifique
const getRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Vérifier les permissions
    const hasPermission = await checkRequestPermissions(userId, userRole, id);
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'avez pas les permissions pour voir cette demande'
      });
    }
    
    // Récupérer les détails de la demande
    const requests = await query(`
      SELECT 
        c.*,
        u.nom as creator_nom,
        u.prenom as creator_prenom,
        u.role as creator_role,
        u.email as creator_email
      FROM clients c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.id = ? 
      AND (c.modification_en_attente IS NOT NULL OR c.nouveau_mot_de_passe_attente IS NOT NULL)
    `, [id]);
    
    if (requests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Aucune demande trouvée pour ce client'
      });
    }
    
    const request = requests[0];
    
    // Récupérer l'historique des actions pour ce client
    const history = await query(`
      SELECT 
        h.*,
        u.nom as user_nom,
        u.prenom as user_prenom
      FROM historique_actions h
      LEFT JOIN users u ON h.user_id = u.id
      WHERE h.enregistrement_id = ? 
      AND h.action IN ('REQUEST_PROFILE_UPDATE', 'REQUEST_PASSWORD_CHANGE', 'APPROVE_PROFILE_UPDATE', 'REJECT_PROFILE_UPDATE', 'APPROVE_PASSWORD_CHANGE', 'REJECT_PASSWORD_CHANGE')
      ORDER BY h.date_action DESC
      LIMIT 10
    `, [id]);
    
    // Traiter les données
    let modification_details = null;
    if (request.modification_en_attente) {
      try {
        modification_details = JSON.parse(request.modification_en_attente);
      } catch (e) {
        console.error('Erreur parsing modification_en_attente:', e);
      }
    }
    
    const processedRequest = {
      ...request,
      modification_details,
      has_password_request: !!request.nouveau_mot_de_passe_attente,
      urgency: calculateUrgency(
        request.modification_demandee_le || request.mot_de_passe_demande_le
      ),
      history: history.map(h => ({
        ...h,
        user_display_name: h.user_nom ? `${h.user_prenom} ${h.user_nom}` : 'Système'
      })),
      // Masquer les données sensibles
      modification_en_attente: undefined,
      nouveau_mot_de_passe_attente: undefined,
      mot_de_passe: undefined
    };
    
    res.json({
      success: true,
      data: processedRequest
    });

  } catch (error) {
    console.error('Erreur récupération détail demande:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération du détail'
    });
  }
};

// Fonction utilitaire pour calculer l'urgence
const calculateUrgency = (dateStr) => {
  if (!dateStr) return 'normale';
  
  const requestDate = new Date(dateStr);
  const now = new Date();
  const daysDiff = Math.floor((now - requestDate) / (1000 * 60 * 60 * 24));
  
  if (daysDiff > 7) return 'urgent';
  if (daysDiff > 3) return 'moderee';
  return 'normale';
};

// Fonction utilitaire pour notifier un client (réutilisable)
const notifyClient = async (clientId, type, titre, message, additionalData = {}) => {
  try {
    await query(`
      INSERT INTO notifications_client (client_id, type, titre, message, data)
      VALUES (?, ?, ?, ?, ?)
    `, [clientId, type, titre, message, JSON.stringify(additionalData)]);
    
    return true;
  } catch (error) {
    console.error('Erreur création notification client:', error);
    return false;
  }
};

module.exports = {
  getPendingRequests,
  approveProfileUpdate,
  rejectProfileUpdate,
  approvePasswordChange,
  rejectPasswordChange,
  getRequestsStats,
  getRequestById,
  notifyClient,
  checkRequestPermissions
};