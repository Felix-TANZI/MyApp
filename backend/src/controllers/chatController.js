const { query } = require('../utils/auth');

// GET /api/chat/conversations - Liste des conversations
const getConversations = async (req, res) => {
  try {
    const { userId, userType } = req.user;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 20));
    const statut = req.query.statut || '';
    const search = String(req.query.search || '').trim();
    
    const offset = (page - 1) * limit;
    
    let whereConditions = [];
    let queryParams = [];
    
    // Filtrage selon le type d'utilisateur
    if (userType === 'client') {
      // Les clients ne voient que leurs conversations
      whereConditions.push('client_id = ?');
      queryParams.push(userId);
    } else {
      // Les professionnels voient toutes les conversations
      // Pas de restriction supplémentaire
    }
    
    if (statut && ['active', 'fermee', 'en_attente'].includes(statut)) {
      whereConditions.push('statut = ?');
      queryParams.push(statut);
    }
    
    if (search) {
      whereConditions.push(`(
        client_nom LIKE ? OR 
        client_prenom LIKE ? OR 
        client_entreprise LIKE ? OR 
        sujet LIKE ? OR
        dernier_message LIKE ?
      )`);
      const searchParam = `%${search}%`;
      queryParams.push(searchParam, searchParam, searchParam, searchParam, searchParam);
    }
    
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';
    
    // Compter le total
    const [countResult] = await query(`
      SELECT COUNT(*) as total FROM vue_conversations_chat ${whereClause}
    `, queryParams);
    
    // Récupérer les conversations avec pagination
    const conversations = await query(`
      SELECT * FROM vue_conversations_chat 
      ${whereClause}
      ORDER BY derniere_activite DESC
      LIMIT ${limit} OFFSET ${offset}
    `, queryParams);
    
    res.json({
      success: true,
      data: {
        conversations,
        pagination: {
          page,
          limit,
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / limit),
          hasNext: page < Math.ceil(countResult.total / limit),
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Erreur récupération conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des conversations'
    });
  }
};

// POST /api/chat/conversations - Créer une nouvelle conversation (client uniquement)
const createConversation = async (req, res) => {
  try {
    const { userId, userType } = req.user;
    const { sujet = 'Support général' } = req.body;

    // Seuls les clients peuvent créer des conversations
    if (userType !== 'client') {
      return res.status(403).json({
        success: false,
        message: 'Seuls les clients peuvent créer des conversations'
      });
    }

    // Vérifier si le client a déjà une conversation active
    const existingConversations = await query(`
      SELECT id FROM conversations 
      WHERE client_id = ? AND statut = 'active'
    `, [userId]);

    if (existingConversations.length > 0) {
      return res.json({
        success: true,
        message: 'Conversation existante trouvée',
        data: {
          conversation_id: existingConversations[0].id
        }
      });
    }

    // Créer une nouvelle conversation
    const result = await query(`
      INSERT INTO conversations (client_id, sujet) 
      VALUES (?, ?)
    `, [userId, sujet]);

    // Ajouter le client comme participant
    await query(`
      INSERT INTO chat_participants (conversation_id, user_type, user_id, en_ligne)
      VALUES (?, 'client', ?, FALSE)
    `, [result.insertId, userId]);

    // Récupérer la conversation créée
    const newConversation = await query(`
      SELECT * FROM vue_conversations_chat WHERE id = ?
    `, [result.insertId]);

    // Log de l'action
    await query(`
      INSERT INTO historique_actions (
        client_id, user_type, action, table_concernee, 
        enregistrement_id, nouvelles_valeurs, ip_address
      ) VALUES (?, 'client', 'CREATE_CONVERSATION', 'conversations', ?, ?, ?)
    `, [
      userId, 
      result.insertId, 
      JSON.stringify({ sujet }),
      req.ip
    ]);

    res.status(201).json({
      success: true,
      message: 'Conversation créée avec succès',
      data: newConversation[0]
    });

  } catch (error) {
    console.error('Erreur création conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la création de la conversation'
    });
  }
};

// GET /api/chat/conversations/:id - Récupérer une conversation spécifique
const getConversationById = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, userType } = req.user;

    // Vérifier l'accès à la conversation
    const hasAccess = await checkConversationAccess(id, userId, userType);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à cette conversation'
      });
    }

    // Récupérer la conversation
    const conversations = await query(`
      SELECT * FROM vue_conversations_chat WHERE id = ?
    `, [id]);

    if (conversations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conversation introuvable'
      });
    }

    res.json({
      success: true,
      data: conversations[0]
    });

  } catch (error) {
    console.error('Erreur récupération conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération de la conversation'
    });
  }
};

// GET /api/chat/conversations/:id/messages - Messages d'une conversation
const getConversationMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, userType } = req.user;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 50));
    
    const offset = (page - 1) * limit;

    // Vérifier l'accès à la conversation
    const hasAccess = await checkConversationAccess(id, userId, userType);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à cette conversation'
      });
    }

    // Compter le total de messages
    const [countResult] = await query(`
      SELECT COUNT(*) as total FROM messages WHERE conversation_id = ?
    `, [id]);

    // Récupérer les messages avec pagination (du plus récent au plus ancien)
    const messages = await query(`
      SELECT * FROM vue_messages_chat 
      WHERE conversation_id = ?
      ORDER BY date_creation DESC
      LIMIT ${limit} OFFSET ${offset}
    `, [id]);

    // Inverser l'ordre pour afficher du plus ancien au plus récent
    messages.reverse();

    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          page,
          limit,
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / limit),
          hasNext: page < Math.ceil(countResult.total / limit),
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Erreur récupération messages:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des messages'
    });
  }
};

// POST /api/chat/conversations/:id/close - Fermer une conversation (professionnels uniquement)
const closeConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, userType } = req.user;

    // Seuls les professionnels peuvent fermer des conversations
    if (userType !== 'user') {
      return res.status(403).json({
        success: false,
        message: 'Seuls les professionnels peuvent fermer les conversations'
      });
    }

    // Vérifier l'accès à la conversation
    const hasAccess = await checkConversationAccess(id, userId, userType);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à cette conversation'
      });
    }

    // Vérifier que la conversation existe et n'est pas déjà fermée
    const conversations = await query(`
      SELECT id, statut FROM conversations WHERE id = ?
    `, [id]);

    if (conversations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conversation introuvable'
      });
    }

    if (conversations[0].statut === 'fermee') {
      return res.status(400).json({
        success: false,
        message: 'Cette conversation est déjà fermée'
      });
    }

    // Fermer la conversation
    await query(`
      UPDATE conversations 
      SET statut = 'fermee', ferme_par = ?, ferme_le = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [userId, id]);

    // Ajouter un message système
    await query(`
      INSERT INTO messages (conversation_id, sender_type, sender_id, message, type_message)
      VALUES (?, 'user', ?, 'Conversation fermée par un membre de l\'équipe', 'system')
    `, [id, userId]);

    // Log de l'action
    await query(`
      INSERT INTO historique_actions (
        user_id, user_type, action, table_concernee, 
        enregistrement_id, nouvelles_valeurs, ip_address
      ) VALUES (?, 'user', 'CLOSE_CONVERSATION', 'conversations', ?, ?, ?)
    `, [
      userId, 
      id, 
      JSON.stringify({ action: 'Conversation fermée' }),
      req.ip
    ]);

    res.json({
      success: true,
      message: 'Conversation fermée avec succès'
    });

  } catch (error) {
    console.error('Erreur fermeture conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la fermeture de la conversation'
    });
  }
};

// POST /api/chat/conversations/:id/reopen - Rouvrir une conversation (professionnels uniquement)
const reopenConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, userType } = req.user;

    // Seuls les professionnels peuvent rouvrir des conversations
    if (userType !== 'user') {
      return res.status(403).json({
        success: false,
        message: 'Seuls les professionnels peuvent rouvrir les conversations'
      });
    }

    // Vérifier l'accès à la conversation
    const hasAccess = await checkConversationAccess(id, userId, userType);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à cette conversation'
      });
    }

    // Rouvrir la conversation
    await query(`
      UPDATE conversations 
      SET statut = 'active', ferme_par = NULL, ferme_le = NULL, derniere_activite = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [id]);

    // Ajouter un message système
    await query(`
      INSERT INTO messages (conversation_id, sender_type, sender_id, message, type_message)
      VALUES (?, 'user', ?, 'Conversation rouverte par un membre de l\'équipe', 'system')
    `, [id, userId]);

    res.json({
      success: true,
      message: 'Conversation rouverte avec succès'
    });

  } catch (error) {
    console.error('Erreur réouverture conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la réouverture de la conversation'
    });
  }
};

// GET /api/chat/conversations/:id/participants - Participants d'une conversation
const getConversationParticipants = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, userType } = req.user;

    // Vérifier l'accès à la conversation
    const hasAccess = await checkConversationAccess(id, userId, userType);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à cette conversation'
      });
    }

    const participants = await query(`
      SELECT 
        cp.user_type,
        cp.user_id,
        cp.en_ligne,
        cp.derniere_vue,
        CASE 
          WHEN cp.user_type = 'client' THEN c.nom
          WHEN cp.user_type = 'user' THEN u.nom
        END as nom,
        CASE 
          WHEN cp.user_type = 'client' THEN c.prenom
          WHEN cp.user_type = 'user' THEN u.prenom
        END as prenom,
        CASE 
          WHEN cp.user_type = 'client' THEN c.code_client
          WHEN cp.user_type = 'user' THEN u.matricule
        END as code,
        CASE 
          WHEN cp.user_type = 'client' THEN 'Client'
          WHEN cp.user_type = 'user' THEN u.role
        END as role
      FROM chat_participants cp
      LEFT JOIN clients c ON (cp.user_type = 'client' AND cp.user_id = c.id)
      LEFT JOIN users u ON (cp.user_type = 'user' AND cp.user_id = u.id)
      WHERE cp.conversation_id = ?
      ORDER BY cp.en_ligne DESC, cp.derniere_vue DESC
    `, [id]);

    res.json({
      success: true,
      data: participants
    });

  } catch (error) {
    console.error('Erreur récupération participants:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des participants'
    });
  }
};

// GET /api/chat/stats - Statistiques du chat (professionnels uniquement)
const getChatStats = async (req, res) => {
  try {
    const { userType } = req.user;

    // Seuls les professionnels peuvent voir les stats
    if (userType !== 'user') {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé aux statistiques'
      });
    }

    const stats = await query(`
      SELECT 
        COUNT(*) as total_conversations,
        COUNT(CASE WHEN statut = 'active' THEN 1 END) as conversations_actives,
        COUNT(CASE WHEN statut = 'fermee' THEN 1 END) as conversations_fermees,
        COUNT(CASE WHEN DATE(date_creation) = CURDATE() THEN 1 END) as conversations_aujourd_hui,
        COUNT(CASE WHEN YEARWEEK(date_creation) = YEARWEEK(CURDATE()) THEN 1 END) as conversations_semaine,
        (SELECT COUNT(*) FROM messages WHERE DATE(date_creation) = CURDATE()) as messages_aujourd_hui,
        (SELECT COUNT(*) FROM messages WHERE YEARWEEK(date_creation) = YEARWEEK(CURDATE())) as messages_semaine,
        (SELECT COUNT(DISTINCT client_id) FROM conversations WHERE DATE(date_creation) = CURDATE()) as nouveaux_clients_aujourd_hui
      FROM conversations
    `);

    // Statistiques des participants en ligne
    const onlineStats = await query(`
      SELECT 
        COUNT(CASE WHEN user_type = 'client' AND en_ligne = TRUE THEN 1 END) as clients_en_ligne,
        COUNT(CASE WHEN user_type = 'user' AND en_ligne = TRUE THEN 1 END) as professionnels_en_ligne,
        COUNT(*) as total_participants_actifs
      FROM chat_participants 
      WHERE derniere_vue >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    `);

    res.json({
      success: true,
      data: {
        ...stats[0],
        ...onlineStats[0]
      }
    });

  } catch (error) {
    console.error('Erreur statistiques chat:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des statistiques'
    });
  }
};

// FONCTION UTILITAIRE

// Vérifier l'accès à une conversation
const checkConversationAccess = async (conversationId, userId, userType) => {
  try {
    if (userType === 'client') {
      // Les clients ne peuvent accéder qu'à leurs conversations
      const conversations = await query(
        'SELECT id FROM conversations WHERE id = ? AND client_id = ?',
        [conversationId, userId]
      );
      return conversations.length > 0;
    }

    if (userType === 'user') {
      // Les professionnels peuvent accéder à toutes les conversations
      const users = await query(
        'SELECT role FROM users WHERE id = ? AND role IN (?, ?, ?)',
        [userId, 'admin', 'commercial', 'comptable']
      );
      return users.length > 0;
    }

    return false;
  } catch (error) {
    console.error('Erreur vérification accès conversation:', error);
    return false;
  }
};

module.exports = {
  getConversations,
  createConversation,
  getConversationById,
  getConversationMessages,
  closeConversation,
  reopenConversation,
  getConversationParticipants,
  getChatStats
};