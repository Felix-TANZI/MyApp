const { query } = require('../utils/auth');
const jwt = require('jsonwebtoken');

class ChatService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> { socketId, userType, userInfo }
    this.conversationRooms = new Map(); // conversationId -> Set of socketIds
  }

  // Initialiser le service avec Socket.IO
  initialize(io) {
    this.io = io;
    this.setupSocketEvents();
    console.log('✅ Service de chat initialisé');
  }

  // Configuration des événements Socket.IO
  setupSocketEvents() {
    this.io.on('connection', (socket) => {
      console.log(`Nouvelle connexion chat: ${socket.id}`);

      // Authentification du socket
      socket.on('chat_authenticate', async (data) => {
        try {
          await this.authenticateSocket(socket, data);
        } catch (error) {
          console.error('Erreur authentification socket chat:', error);
          socket.emit('chat_auth_error', { message: error.message || 'Authentification échouée' });
          socket.disconnect();
        }
      });

      // Rejoindre une conversation
      socket.on('join_conversation', async (data) => {
        try {
          await this.joinConversation(socket, data);
        } catch (error) {
          console.error('Erreur join conversation:', error);
          socket.emit('error', { message: 'Impossible de rejoindre la conversation' });
        }
      });

      // Quitter une conversation
      socket.on('leave_conversation', async (data) => {
        try {
          await this.leaveConversation(socket, data);
        } catch (error) {
          console.error('Erreur leave conversation:', error);
        }
      });

      // Envoyer un message
      socket.on('send_message', async (data) => {
        try {
          await this.sendMessage(socket, data);
        } catch (error) {
          console.error('Erreur envoi message:', error);
          socket.emit('error', { message: 'Erreur lors de l\'envoi du message' });
        }
      });

      // Marquer des messages comme lus
      socket.on('mark_messages_read', async (data) => {
        try {
          await this.markMessagesAsRead(socket, data);
        } catch (error) {
          console.error('Erreur marquage messages lus:', error);
        }
      });

      // Indicateur de frappe
      socket.on('typing_start', (data) => {
        this.broadcastTyping(socket, data, true);
      });

      socket.on('typing_stop', (data) => {
        this.broadcastTyping(socket, data, false);
      });

      // Déconnexion
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  // Authentifier un socket - CORRIGÉ
  async authenticateSocket(socket, data) {
    const { token, userType } = data;
    
    if (!token) {
      throw new Error('Token manquant');
    }

    try {
      // Vérifier le token JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('🔐 Token décodé:', { decoded, userType });
      
      let userId, actualUserType, userInfo;

      // Déterminer le type et l'ID utilisateur selon le token décodé
      if (decoded.userType === 'client' || (userType === 'client' && decoded.userId)) {
        // Client
        userId = decoded.userId;
        actualUserType = 'client';
        
        const clients = await query(
          'SELECT id, code_client, nom, prenom FROM clients WHERE id = ? AND statut = "actif"',
          [userId]
        );
        userInfo = clients[0];
        
        if (!userInfo) {
          throw new Error('Client non trouvé ou inactif');
        }
      } else if (decoded.userType === 'user' || (userType === 'user' && decoded.userId)) {
        // Professionnel
        userId = decoded.userId;
        actualUserType = 'user';
        
        const users = await query(
          'SELECT id, nom, prenom, role FROM users WHERE id = ? AND statut = "actif"',
          [userId]
        );
        userInfo = users[0];
        
        if (!userInfo) {
          throw new Error('Utilisateur non trouvé ou inactif');
        }
      } else {
        // Fallback : essayer de déterminer automatiquement
        if (decoded.role && ['admin', 'commercial', 'comptable'].includes(decoded.role)) {
          // C'est un professionnel
          userId = decoded.userId;
          actualUserType = 'user';
          
          const users = await query(
            'SELECT id, nom, prenom, role FROM users WHERE id = ? AND statut = "actif"',
            [userId]
          );
          userInfo = users[0];
        } else if (decoded.codeClient) {
          // C'est un client
          userId = decoded.userId;
          actualUserType = 'client';
          
          const clients = await query(
            'SELECT id, code_client, nom, prenom FROM clients WHERE id = ? AND statut = "actif"',
            [userId]
          );
          userInfo = clients[0];
        } else {
          throw new Error('Type d\'utilisateur indéterminé dans le token');
        }
      }

      if (!userInfo) {
        throw new Error('Utilisateur introuvable ou inactif');
      }

      // Stocker les infos dans le socket
      socket.userId = userId;
      socket.userType = actualUserType;
      socket.userInfo = userInfo;
      socket.authenticated = true;

      // Ajouter à la liste des connectés
      this.connectedUsers.set(`${actualUserType}_${userId}`, {
        socketId: socket.id,
        userType: actualUserType,
        userId: userId,
        userInfo,
        connectedAt: new Date(),
        socket: socket
      });

      // Confirmer l'authentification
      socket.emit('chat_authenticated', {
        userId,
        userType: actualUserType,
        userInfo
      });

      console.log(`✅ Chat authentifié: ${actualUserType} ${userInfo.nom} ${userInfo.prenom || ''} (${socket.id})`);

    } catch (jwtError) {
      console.error('Erreur JWT:', jwtError);
      throw new Error('Token invalide ou expiré');
    }
  }

  // Rejoindre une conversation - AMÉLIORÉ
  async joinConversation(socket, data) {
    const { conversationId } = data;
    const { userId, userType } = socket;

    if (!socket.authenticated) {
      socket.emit('error', { message: 'Socket non authentifié' });
      return;
    }

    // Vérifier les permissions
    const hasAccess = await this.checkConversationAccess(conversationId, userId, userType);
    if (!hasAccess) {
      socket.emit('error', { message: 'Accès non autorisé à cette conversation' });
      return;
    }

    // Rejoindre la room
    socket.join(`conversation_${conversationId}`);
    
    // Ajouter à la liste des participants
    if (!this.conversationRooms.has(conversationId)) {
      this.conversationRooms.set(conversationId, new Set());
    }
    this.conversationRooms.get(conversationId).add(socket.id);

    // Mettre à jour le statut en ligne
    await this.updateParticipantStatus(conversationId, userId, userType, true, socket.id);

    // Notifier les autres participants
    socket.to(`conversation_${conversationId}`).emit('user_joined', {
      userId,
      userType,
      userInfo: socket.userInfo
    });

    // Envoyer la liste des participants en ligne
    const onlineParticipants = await this.getOnlineParticipants(conversationId);
    socket.emit('conversation_joined', {
      conversationId,
      onlineParticipants
    });

    console.log(`✅ ${userType} ${socket.userInfo.nom} a rejoint la conversation ${conversationId}`);
  }

  // Quitter une conversation
  async leaveConversation(socket, data) {
    const { conversationId } = data;
    const { userId, userType } = socket;

    if (!socket.authenticated) return;

    // Quitter la room
    socket.leave(`conversation_${conversationId}`);
    
    // Retirer de la liste des participants
    if (this.conversationRooms.has(conversationId)) {
      this.conversationRooms.get(conversationId).delete(socket.id);
    }

    // Mettre à jour le statut hors ligne
    await this.updateParticipantStatus(conversationId, userId, userType, false);

    // Notifier les autres participants
    socket.to(`conversation_${conversationId}`).emit('user_left', {
      userId,
      userType,
      userInfo: socket.userInfo
    });

    console.log(`👋 ${userType} ${socket.userInfo.nom} a quitté la conversation ${conversationId}`);
  }

  // Envoyer un message - AMÉLIORÉ
  async sendMessage(socket, data) {
    const { conversationId, message, type = 'text' } = data;
    const { userId, userType, userInfo } = socket;

    if (!socket.authenticated) {
      socket.emit('error', { message: 'Socket non authentifié' });
      return;
    }

    // Valider le message
    if (!message || message.trim().length === 0) {
      socket.emit('error', { message: 'Message vide' });
      return;
    }

    if (message.length > 2000) {
      socket.emit('error', { message: 'Message trop long (max 2000 caractères)' });
      return;
    }

    // Vérifier les permissions
    const hasAccess = await this.checkConversationAccess(conversationId, userId, userType);
    if (!hasAccess) {
      socket.emit('error', { message: 'Accès non autorisé' });
      return;
    }

    try {
      // Sauvegarder le message en base
      const result = await query(`
        INSERT INTO messages (conversation_id, sender_type, sender_id, message, type_message)
        VALUES (?, ?, ?, ?, ?)
      `, [conversationId, userType, userId, message.trim(), type]);

      // Mettre à jour l'activité de la conversation
      await query(`
        UPDATE conversations 
        SET derniere_activite = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [conversationId]);

      // Récupérer le message créé avec les infos expéditeur
      const newMessage = await query(`
        SELECT * FROM vue_messages_chat WHERE id = ?
      `, [result.insertId]);

      const messageData = newMessage[0];

      // Diffuser le message à tous les participants de la conversation
      this.io.to(`conversation_${conversationId}`).emit('new_message', messageData);

      // Notifier les professionnels hors ligne si c'est un message client
      if (userType === 'client') {
        await this.notifyOfflineProfessionals(conversationId, messageData);
      }

      console.log(`💬 Message envoyé dans conversation ${conversationId} par ${userType} ${userInfo.nom}`);

    } catch (error) {
      console.error('Erreur sauvegarde message:', error);
      socket.emit('error', { message: 'Erreur lors de la sauvegarde du message' });
    }
  }

  // Marquer les messages comme lus
  async markMessagesAsRead(socket, data) {
    const { conversationId } = data;
    const { userId, userType } = socket;

    if (!socket.authenticated) return;

    try {
      // Marquer comme lus
      await query('CALL MarquerMessagesCommeLus(?, ?, ?)', [conversationId, userType, userId]);

      // Notifier les autres participants
      socket.to(`conversation_${conversationId}`).emit('messages_read', {
        userId,
        userType,
        conversationId
      });
    } catch (error) {
      console.error('Erreur marquage messages lus:', error);
    }
  }

  // Gérer l'indicateur de frappe
  broadcastTyping(socket, data, isTyping) {
    const { conversationId } = data;
    const { userId, userType, userInfo } = socket;

    if (!socket.authenticated) return;

    socket.to(`conversation_${conversationId}`).emit('user_typing', {
      userId,
      userType,
      userInfo,
      isTyping
    });
  }

  // Gérer la déconnexion - AMÉLIORÉ
  async handleDisconnect(socket) {
    const { userId, userType } = socket;
    
    if (userId && userType) {
      // Retirer de la liste des connectés
      this.connectedUsers.delete(`${userType}_${userId}`);

      // Mettre à jour le statut dans toutes les conversations
      await query(`
        UPDATE chat_participants 
        SET en_ligne = FALSE, socket_id = NULL 
        WHERE user_id = ? AND user_type = ?
      `, [userId, userType]);

      // Notifier toutes les conversations
      for (const [conversationId, socketIds] of this.conversationRooms) {
        if (socketIds.has(socket.id)) {
          socket.to(`conversation_${conversationId}`).emit('user_left', {
            userId,
            userType,
            userInfo: socket.userInfo
          });
          socketIds.delete(socket.id);
        }
      }

      console.log(`👋 Chat déconnecté: ${userType} ${socket.userInfo?.nom} (${socket.id})`);
    }
  }

  // MÉTHODES UTILITAIRES

  // Vérifier l'accès à une conversation
  async checkConversationAccess(conversationId, userId, userType) {
    try {
      // Les clients ne peuvent accéder qu'à leurs conversations
      if (userType === 'client') {
        const conversations = await query(
          'SELECT id FROM conversations WHERE id = ? AND client_id = ?',
          [conversationId, userId]
        );
        return conversations.length > 0;
      }

      // Les professionnels peuvent accéder à toutes les conversations
      if (userType === 'user') {
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
  }

  // Mettre à jour le statut d'un participant
  async updateParticipantStatus(conversationId, userId, userType, isOnline, socketId = null) {
    try {
      await query(`
        INSERT INTO chat_participants (conversation_id, user_type, user_id, en_ligne, socket_id)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        en_ligne = VALUES(en_ligne),
        socket_id = VALUES(socket_id),
        derniere_vue = CURRENT_TIMESTAMP
      `, [conversationId, userType, userId, isOnline, socketId]);
    } catch (error) {
      console.error('Erreur mise à jour statut participant:', error);
    }
  }

  // Récupérer les participants en ligne
  async getOnlineParticipants(conversationId) {
    try {
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
            WHEN cp.user_type = 'client' THEN 'Client'
            WHEN cp.user_type = 'user' THEN u.role
          END as role
        FROM chat_participants cp
        LEFT JOIN clients c ON (cp.user_type = 'client' AND cp.user_id = c.id)
        LEFT JOIN users u ON (cp.user_type = 'user' AND cp.user_id = u.id)
        WHERE cp.conversation_id = ?
      `, [conversationId]);

      return participants;
    } catch (error) {
      console.error('Erreur récupération participants:', error);
      return [];
    }
  }

  // Notifier les professionnels hors ligne
  async notifyOfflineProfessionals(conversationId, messageData) {
    try {
      // Récupérer les professionnels hors ligne
      const offlineProfessionals = await query(`
        SELECT DISTINCT u.id
        FROM users u
        WHERE u.role IN ('admin', 'commercial', 'comptable')
        AND u.statut = 'actif'
        AND u.id NOT IN (
          SELECT cp.user_id 
          FROM chat_participants cp 
          WHERE cp.conversation_id = ? 
          AND cp.user_type = 'user' 
          AND cp.en_ligne = TRUE
        )
      `, [conversationId]);

      // Créer des notifications pour chaque professionnel hors ligne
      for (const professional of offlineProfessionals) {
        await query(`
          INSERT INTO notifications_users (user_id, type, titre, message, data)
          VALUES (?, 'nouveau_message_chat', 'Nouveau message de chat', ?, ?)
        `, [
          professional.id,
          `Message de ${messageData.sender_nom} ${messageData.sender_prenom}: ${messageData.message.substring(0, 100)}${messageData.message.length > 100 ? '...' : ''}`,
          JSON.stringify({
            conversation_id: conversationId,
            message_id: messageData.id,
            sender_type: messageData.sender_type,
            sender_id: messageData.sender_id
          })
        ]);
      }
    } catch (error) {
      console.error('Erreur notification professionnels hors ligne:', error);
    }
  }

  // Obtenir les statistiques de connexion
  getConnectionStats() {
    const users = Array.from(this.connectedUsers.values());
    const clients = users.filter(u => u.userType === 'client');
    const professionals = users.filter(u => u.userType === 'user');
    
    return {
      totalConnected: this.connectedUsers.size,
      connectedClients: clients.length,
      connectedProfessionals: professionals.length,
      activeConversations: this.conversationRooms.size
    };
  }

  // Diffuser un message système à tous les connectés
  broadcastSystemMessage(message) {
    if (this.io) {
      this.io.emit('system_message', {
        message,
        timestamp: new Date()
      });
    }
  }

  // Fermer une connexion spécifique
  disconnectUser(userType, userId) {
    const userKey = `${userType}_${userId}`;
    const user = this.connectedUsers.get(userKey);
    
    if (user && user.socket) {
      user.socket.disconnect(true);
      this.connectedUsers.delete(userKey);
    }
  }

  // Nettoyer les connexions inactives
  cleanupInactiveConnections() {
    for (const [userKey, userData] of this.connectedUsers.entries()) {
      const timeDiff = Date.now() - userData.connectedAt.getTime();
      
      // Déconnecter après 24 heures d'inactivité
      if (timeDiff > 24 * 60 * 60 * 1000) {
        this.disconnectUser(userData.userType, userData.userId);
        console.log(`🧹 Connexion nettoyée: ${userKey}`);
      }
    }
  }
}

// Instance singleton
const chatService = new ChatService();

module.exports = chatService;