const { query } = require('../utils/auth');
const jwt = require('jsonwebtoken');

// Import du service Assistant Amani
let assistantAmaniService;
try {
  assistantAmaniService = require('./assistantAmaniService');
} catch (error) {
  console.log('⚠️ Service Assistant Amani non disponible dans chatService:', error.message);
  assistantAmaniService = null;
}

class ChatService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map();
    this.conversationRooms = new Map();
    this.socketUserMap = new Map();
  }

  initialize(io) {
    this.io = io;
    this.setupSocketEvents();
    
    setInterval(() => {
      this.cleanupInactiveConnections();
    }, 60000);
    
    console.log('Service de chat initialisé avec nettoyage automatique');
  }

  setupSocketEvents() {
    this.io.on('connection', (socket) => {
      console.log(`Nouvelle connexion chat: ${socket.id}`);

      const authTimeout = setTimeout(() => {
        if (!socket.authenticated) {
          console.log(`Timeout d'authentification pour ${socket.id}`);
          socket.emit('chat_auth_error', { message: 'Timeout d\'authentification' });
          socket.disconnect();
        }
      }, 30000);

      socket.onAny((eventName, ...args) => {
        console.log(`[${socket.id}] Événement: ${eventName}`, 
          args.length > 0 ? JSON.stringify(args[0]).substring(0, 200) : 'sans données'
        );
      });

      socket.on('chat_authenticate', async (data) => {
        console.log(`Tentative d'authentification pour ${socket.id}`);
        clearTimeout(authTimeout);
        
        try {
          await this.authenticateSocket(socket, data);
        } catch (error) {
          console.error(`Erreur authentification ${socket.id}:`, error.message);
          socket.emit('chat_auth_error', { message: error.message || 'Authentification échouée' });
          socket.disconnect();
        }
      });

      socket.on('join_conversation', async (data) => {
        if (!socket.authenticated) {
          socket.emit('error', { message: 'Socket non authentifié' });
          return;
        }
        
        console.log(`[${socket.id}] Tentative de rejoindre conversation:`, data);
        try {
          await this.joinConversation(socket, data);
        } catch (error) {
          console.error(`[${socket.id}] Erreur join conversation:`, error);
          socket.emit('error', { message: 'Impossible de rejoindre la conversation' });
        }
      });

      socket.on('leave_conversation', async (data) => {
        if (!socket.authenticated) return;
        
        console.log(`[${socket.id}] Tentative de quitter conversation:`, data);
        try {
          await this.leaveConversation(socket, data);
        } catch (error) {
          console.error(`[${socket.id}] Erreur leave conversation:`, error);
        }
      });

      socket.on('send_message', async (data) => {
        if (!socket.authenticated) {
          socket.emit('error', { message: 'Socket non authentifié' });
          return;
        }
        
        console.log(`[${socket.id}] Tentative d'envoi message`);
        try {
          await this.sendMessage(socket, data);
        } catch (error) {
          console.error(`[${socket.id}] Erreur envoi message:`, error);
          socket.emit('error', { message: 'Erreur lors de l\'envoi du message' });
        }
      });

      socket.on('mark_messages_read', async (data) => {
        if (!socket.authenticated) return;
        
        console.log(`[${socket.id}] Marquage messages lus:`, data);
        try {
          await this.markMessagesAsRead(socket, data);
        } catch (error) {
          console.error(`[${socket.id}] Erreur marquage messages lus:`, error);
        }
      });

      socket.on('typing_start', (data) => {
        if (!socket.authenticated) return;
        console.log(`[${socket.id}] Début frappe:`, data);
        this.broadcastTyping(socket, data, true);
      });

      socket.on('typing_stop', (data) => {
        if (!socket.authenticated) return;
        console.log(`[${socket.id}] Fin frappe:`, data);
        this.broadcastTyping(socket, data, false);
      });

      socket.on('ping', () => {
        socket.emit('pong');
      });

      socket.on('disconnect', (reason) => {
        console.log(`[${socket.id}] Déconnecté: ${reason}`);
        this.handleDisconnect(socket);
        clearTimeout(authTimeout);
      });

      socket.on('error', (error) => {
        console.error(`[${socket.id}] Erreur socket:`, error);
      });
    });
  }

  async authenticateSocket(socket, data) {
    console.log('Début authentification socket détaillée');
    
    const { token, userType } = data || {};
    
    if (!token) {
      throw new Error('Token manquant');
    }

    if (!userType || !['user', 'client'].includes(userType)) {
      throw new Error('Type d\'utilisateur invalide');
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Token vérifié:', {
        userId: decoded.userId,
        userType: decoded.userType,
        role: decoded.role,
        exp: new Date(decoded.exp * 1000)
      });
      
      if (decoded.exp * 1000 <= Date.now()) {
        throw new Error('Token expiré');
      }

      let userId, actualUserType, userInfo;

      if (userType === 'client' && decoded.userType === 'client') {
        userId = decoded.userId;
        actualUserType = 'client';
        
        const clients = await query(
          'SELECT id, code_client, nom, prenom FROM clients WHERE id = ? AND statut = "actif" AND deleted_at IS NULL',
          [userId]
        );
        userInfo = clients[0];
      } else if (userType === 'user' && decoded.userType === 'user') {
        userId = decoded.userId;
        actualUserType = 'user';
        
        const users = await query(
          'SELECT id, nom, prenom, role FROM users WHERE id = ? AND statut = "actif"',
          [userId]
        );
        userInfo = users[0];
      } else {
        throw new Error('Incohérence entre le type demandé et le token');
      }

      if (!userInfo) {
        throw new Error('Utilisateur non trouvé ou inactif');
      }

      const existingUserKey = `${actualUserType}_${userId}`;
      const existingConnection = this.connectedUsers.get(existingUserKey);
      
      if (existingConnection && existingConnection.socketId !== socket.id) {
        console.log(`Déconnexion ancienne session pour ${userInfo.nom}`);
        const oldSocket = this.io.sockets.sockets.get(existingConnection.socketId);
        if (oldSocket) {
          oldSocket.emit('session_replaced', { message: 'Nouvelle connexion détectée' });
          oldSocket.disconnect();
        }
      }

      socket.userId = userId;
      socket.userType = actualUserType;
      socket.userInfo = userInfo;
      socket.authenticated = true;
      socket.authenticatedAt = new Date();

      const userKey = `${actualUserType}_${userId}`;
      this.connectedUsers.set(userKey, {
        socketId: socket.id,
        userType: actualUserType,
        userId: userId,
        userInfo,
        connectedAt: new Date(),
        lastActivity: new Date(),
        socket: socket
      });

      this.socketUserMap.set(socket.id, {
        userId,
        userType: actualUserType,
        userKey
      });

      socket.emit('chat_authenticated', {
        userId,
        userType: actualUserType,
        userInfo,
        connectedAt: new Date()
      });

      console.log(`Chat authentifié: ${actualUserType} ${userInfo.nom} ${userInfo.prenom || ''} (${socket.id})`);

    } catch (jwtError) {
      console.error('Erreur JWT:', {
        name: jwtError.name,
        message: jwtError.message,
        expiredAt: jwtError.expiredAt
      });
      throw new Error('Token invalide: ' + jwtError.message);
    }
  }

  async joinConversation(socket, data) {
    const { conversationId } = data;
    const { userId, userType } = socket;

    if (!socket.authenticated || !conversationId) {
      socket.emit('error', { message: 'Paramètres invalides' });
      return;
    }

    console.log(`${socket.userInfo.nom} tente de rejoindre conversation ${conversationId}`);

    const hasAccess = await this.checkConversationAccess(conversationId, userId, userType);
    if (!hasAccess) {
      console.log(`Accès refusé pour ${socket.userInfo.nom} à la conversation ${conversationId}`);
      socket.emit('error', { message: 'Accès non autorisé à cette conversation' });
      return;
    }

    const conversations = await query('SELECT id, statut FROM conversations WHERE id = ?', [conversationId]);
    if (conversations.length === 0) {
      socket.emit('error', { message: 'Conversation introuvable' });
      return;
    }

    const conversation = conversations[0];
    console.log(`Accès autorisé à la conversation ${conversationId} (statut: ${conversation.statut})`);

    const roomName = `conversation_${conversationId}`;
    socket.join(roomName);
    
    if (!this.conversationRooms.has(conversationId)) {
      this.conversationRooms.set(conversationId, new Set());
    }
    this.conversationRooms.get(conversationId).add(socket.id);

    await this.updateParticipantStatus(conversationId, userId, userType, true, socket.id);

    const onlineParticipants = await this.getOnlineParticipants(conversationId);

    socket.to(roomName).emit('user_joined', {
      userId,
      userType,
      userInfo: socket.userInfo
    });

    socket.emit('conversation_joined', {
      conversationId,
      onlineParticipants,
      conversationStatus: conversation.statut
    });

    console.log(`${socket.userInfo.nom} a rejoint la conversation ${conversationId} avec ${onlineParticipants.length} participants`);
  }

  async leaveConversation(socket, data) {
    const { conversationId } = data;
    const { userId, userType } = socket;

    if (!socket.authenticated || !conversationId) return;

    console.log(`${socket.userInfo.nom} quitte la conversation ${conversationId}`);

    const roomName = `conversation_${conversationId}`;
    socket.leave(roomName);
    
    if (this.conversationRooms.has(conversationId)) {
      this.conversationRooms.get(conversationId).delete(socket.id);
      
      if (this.conversationRooms.get(conversationId).size === 0) {
        this.conversationRooms.delete(conversationId);
      }
    }

    await this.updateParticipantStatus(conversationId, userId, userType, false);

    socket.to(roomName).emit('user_left', {
      userId,
      userType,
      userInfo: socket.userInfo
    });

    console.log(`${socket.userInfo.nom} a quitté la conversation ${conversationId}`);
  }

  async sendMessage(socket, data) {
    const { conversationId, message, type = 'text' } = data;
    const { userId, userType, userInfo } = socket;

    if (!socket.authenticated || !conversationId || !message) {
      socket.emit('error', { message: 'Paramètres invalides' });
      return;
    }

    this.updateUserActivity(socket);

    const cleanMessage = message.trim();
    if (cleanMessage.length === 0) {
      socket.emit('error', { message: 'Message vide' });
      return;
    }

    if (cleanMessage.length > 2000) {
      socket.emit('error', { message: 'Message trop long (max 2000 caractères)' });
      return;
    }

    const hasAccess = await this.checkConversationAccess(conversationId, userId, userType);
    if (!hasAccess) {
      socket.emit('error', { message: 'Accès non autorisé' });
      return;
    }

    if (userType === 'client') {
      const conversations = await query(
        'SELECT statut FROM conversations WHERE id = ?', 
        [conversationId]
      );
      
      if (conversations.length === 0 || conversations[0].statut !== 'active') {
        socket.emit('error', { message: 'Cette conversation n\'est pas active' });
        return;
      }
    }

    try {
      // Sauvegarder le message
      const result = await query(`
        INSERT INTO messages (conversation_id, sender_type, sender_id, message, type_message)
        VALUES (?, ?, ?, ?, ?)
      `, [conversationId, userType, userId, cleanMessage, type]);

      await query(`
        UPDATE conversations 
        SET derniere_activite = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [conversationId]);

      const newMessages = await query(`
        SELECT * FROM vue_messages_chat WHERE id = ?
      `, [result.insertId]);

      if (newMessages.length === 0) {
        throw new Error('Message créé mais non récupérable');
      }

      const messageData = newMessages[0];

      console.log(`Message sauvé: ID ${messageData.id} de ${userInfo.nom} dans conversation ${conversationId}`);

      // Diffuser le message à tous les participants
      const roomName = `conversation_${conversationId}`;
      this.io.to(roomName).emit('new_message', messageData);

      console.log(`Message diffusé à la room ${roomName}`);

      // ASSISTANT AMANI: Si c'est un message client et que l'assistant est disponible
      if (userType === 'client' && assistantAmaniService?.isEnabled()) {
        const professionnelsEnLigne = await this.checkOnlineProfessionals();
        
        if (professionnelsEnLigne === 0) {
          console.log('Assistant Amani activé - aucun professionnel en ligne');
          
          // Délai de 2 secondes pour laisser le temps aux professionnels de répondre
          setTimeout(async () => {
            try {
              // Vérifier à nouveau s'il n'y a toujours pas de professionnels
              const stillNoProfessionals = await this.checkOnlineProfessionals();
              
              if (stillNoProfessionals === 0) {
                await this.handleAssistantResponse(conversationId, cleanMessage, userId);
              } else {
                console.log('Assistant Amani annulé - professionnel connecté entre temps');
              }
            } catch (error) {
              console.error('Erreur Assistant Amani:', error);
            }
          }, 2000);
        }
      }

      // Notification des professionnels hors ligne pour les messages clients
      if (userType === 'client') {
        await this.notifyOfflineProfessionals(conversationId, messageData);
      }

      // Debug info
      const socketsInRoom = await this.io.in(roomName).allSockets();
      console.log(`Room ${roomName} contient ${socketsInRoom.size} sockets`);

    } catch (error) {
      console.error(`Erreur sauvegarde message:`, error);
      socket.emit('error', { message: 'Erreur lors de la sauvegarde du message' });
    }
  }

  // ASSISTANT AMANI: Gestion de la réponse de l'assistant
  async handleAssistantResponse(conversationId, clientMessage, clientId) {
    if (!assistantAmaniService) {
      console.log('Service Assistant non disponible');
      return;
    }

    try {
      console.log('Génération réponse Assistant Amani...');
      
      // Récupérer le contexte client
      const clientContext = await assistantAmaniService.getClientContext(clientId);
      
      // Générer la réponse de l'assistant
      const assistantResponse = await assistantAmaniService.getAssistantResponse(
        clientMessage, 
        clientContext
      );

      if (!assistantResponse) {
        console.log('Assistant Amani n\'a pas généré de réponse');
        return;
      }

      console.log('Assistant Amani response:', {
        shouldEscalate: assistantResponse.shouldEscalate,
        escalationReason: assistantResponse.escalationReason
      });

      // Sauvegarder le message de l'assistant
      const assistantMessageResult = await query(`
        INSERT INTO messages (conversation_id, sender_type, sender_id, message, type_message)
        VALUES (?, 'assistant', 0, ?, 'assistant')
      `, [conversationId, assistantResponse.message]);

      // Récupérer le message formaté
      const assistantMessages = await query(`
        SELECT * FROM vue_messages_chat WHERE id = ?
      `, [assistantMessageResult.insertId]);

      if (assistantMessages.length > 0) {
        const assistantMessageData = assistantMessages[0];
        
        // Diffuser le message de l'assistant
        const roomName = `conversation_${conversationId}`;
        this.io.to(roomName).emit('new_message', assistantMessageData);
        
        console.log('Message Assistant Amani diffusé');

        // Si escalade nécessaire, notifier les professionnels
        if (assistantResponse.shouldEscalate) {
          console.log('Escalade demandée par l\'assistant');
          await this.notifyProfessionalsForEscalation(conversationId, assistantResponse);
        }
      }

      // Mettre à jour l'activité de la conversation
      await query(`
        UPDATE conversations 
        SET derniere_activite = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [conversationId]);

    } catch (error) {
      console.error('Erreur gestion réponse Assistant Amani:', error);
      
      // Message de fallback en cas d'erreur
      try {
        const fallbackResult = await query(`
          INSERT INTO messages (conversation_id, sender_type, sender_id, message, type_message)
          VALUES (?, 'assistant', 0, ?, 'assistant')
        `, [
          conversationId, 
          'Je rencontre une difficulté technique. Un membre de notre équipe vous contactera rapidement.'
        ]);

        const fallbackMessages = await query(`
          SELECT * FROM vue_messages_chat WHERE id = ?
        `, [fallbackResult.insertId]);

        if (fallbackMessages.length > 0) {
          const roomName = `conversation_${conversationId}`;
          this.io.to(roomName).emit('new_message', fallbackMessages[0]);
        }

        // Forcer l'escalade en cas d'erreur
        await this.notifyProfessionalsForEscalation(conversationId, {
          escalationReason: 'Erreur technique Assistant Amani',
          clientContext: `Conversation ${conversationId}`
        });

      } catch (fallbackError) {
        console.error('Erreur message fallback:', fallbackError);
      }
    }
  }

  // ASSISTANT AMANI: Vérifier le nombre de professionnels en ligne
  async checkOnlineProfessionals() {
    try {
      const result = await query(`
        SELECT COUNT(*) as count 
        FROM chat_participants cp
        WHERE cp.user_type = 'user' 
        AND cp.en_ligne = TRUE 
        AND cp.derniere_vue >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
      `);
      
      return result[0]?.count || 0;
    } catch (error) {
      console.error('Erreur vérification professionnels en ligne:', error);
      return 0;
    }
  }

  // ASSISTANT AMANI: Notification d'escalade
  async notifyProfessionalsForEscalation(conversationId, assistantResponse) {
    try {
      const allProfessionals = await query(`
        SELECT id, nom, prenom, email FROM users 
        WHERE role IN ('admin', 'commercial', 'comptable') 
        AND statut = 'actif'
      `);

      const escalationMessage = assistantResponse.escalationReason || 'Intervention requise';

      for (const professional of allProfessionals) {
        await query(`
          INSERT INTO notifications_users (user_id, type, titre, message, data)
          VALUES (?, 'chat_escalation', 'Intervention requise - Chat Client', ?, ?)
        `, [
          professional.id,
          `Assistant Amani demande votre intervention: ${escalationMessage}`,
          JSON.stringify({
            conversation_id: conversationId,
            escalation_reason: assistantResponse.escalationReason,
            client_context: assistantResponse.clientContext,
            timestamp: new Date().toISOString()
          })
        ]);
      }

      console.log(`${allProfessionals.length} professionnels notifiés pour escalade`);
    } catch (error) {
      console.error('Erreur notification escalade:', error);
    }
  }

  async markMessagesAsRead(socket, data) {
    const { conversationId } = data;
    const { userId, userType } = socket;

    if (!socket.authenticated || !conversationId) return;

    try {
      await query('CALL MarquerMessagesCommeLus(?, ?, ?)', [conversationId, userType, userId]);

      console.log(`Messages marqués comme lus pour ${socket.userInfo.nom} dans conversation ${conversationId}`);

      const roomName = `conversation_${conversationId}`;
      socket.to(roomName).emit('messages_read', {
        userId,
        userType,
        conversationId
      });
    } catch (error) {
      console.error('Erreur marquage messages lus:', error);
    }
  }

  broadcastTyping(socket, data, isTyping) {
    const { conversationId } = data;
    const { userId, userType, userInfo } = socket;

    if (!socket.authenticated || !conversationId) return;

    this.updateUserActivity(socket);

    const roomName = `conversation_${conversationId}`;
    socket.to(roomName).emit('user_typing', {
      userId,
      userType,
      userInfo,
      isTyping
    });

    if (isTyping) {
      const typingKey = `typing_${userId}_${conversationId}`;
      
      if (socket.typingTimeouts && socket.typingTimeouts[typingKey]) {
        clearTimeout(socket.typingTimeouts[typingKey]);
      }

      if (!socket.typingTimeouts) socket.typingTimeouts = {};
      socket.typingTimeouts[typingKey] = setTimeout(() => {
        socket.to(roomName).emit('user_typing', {
          userId,
          userType,
          userInfo,
          isTyping: false
        });
        delete socket.typingTimeouts[typingKey];
      }, 5000);
    }
  }

  async handleDisconnect(socket) {
    const { userId, userType } = socket;
    
    if (!userId || !userType) return;

    console.log(`Déconnexion chat: ${socket.userInfo?.nom || 'Inconnu'} (${socket.id})`);

    if (socket.typingTimeouts) {
      Object.values(socket.typingTimeouts).forEach(timeout => clearTimeout(timeout));
    }

    const userKey = `${userType}_${userId}`;
    this.connectedUsers.delete(userKey);
    this.socketUserMap.delete(socket.id);

    await query(`
      UPDATE chat_participants 
      SET en_ligne = FALSE, socket_id = NULL 
      WHERE user_id = ? AND user_type = ?
    `, [userId, userType]);

    for (const [conversationId, socketIds] of this.conversationRooms.entries()) {
      if (socketIds.has(socket.id)) {
        const roomName = `conversation_${conversationId}`;
        socket.to(roomName).emit('user_left', {
          userId,
          userType,
          userInfo: socket.userInfo
        });
        socketIds.delete(socket.id);

        if (socketIds.size === 0) {
          this.conversationRooms.delete(conversationId);
        }
      }
    }

    console.log(`Nettoyage terminé pour ${socket.userInfo?.nom || socket.id}`);
  }

  updateUserActivity(socket) {
    const userKey = this.socketUserMap.get(socket.id)?.userKey;
    if (userKey && this.connectedUsers.has(userKey)) {
      const userData = this.connectedUsers.get(userKey);
      userData.lastActivity = new Date();
      this.connectedUsers.set(userKey, userData);
    }
  }

  async checkConversationAccess(conversationId, userId, userType) {
    try {
      console.log(`Vérification accès: conversation ${conversationId}, user ${userId} (${userType})`);

      if (userType === 'client') {
        const conversations = await query(
          'SELECT id FROM conversations WHERE id = ? AND client_id = ?',
          [conversationId, userId]
        );
        const hasAccess = conversations.length > 0;
        console.log(`Client ${userId}: ${hasAccess ? 'AUTORISÉ' : 'REFUSÉ'}`);
        return hasAccess;
      }

      if (userType === 'user') {
        const users = await query(
          'SELECT id, role FROM users WHERE id = ? AND role IN (?, ?, ?) AND statut = "actif"',
          [userId, 'admin', 'commercial', 'comptable']
        );
        const hasAccess = users.length > 0;
        console.log(`Professionnel ${userId}: ${hasAccess ? 'AUTORISÉ' : 'REFUSÉ'}`);
        return hasAccess;
      }

      console.log(`Type utilisateur non reconnu: ${userType}`);
      return false;
    } catch (error) {
      console.error('Erreur vérification accès conversation:', error);
      return false;
    }
  }

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

      console.log(`Statut participant mis à jour: ${userType} ${userId} -> ${isOnline ? 'EN LIGNE' : 'HORS LIGNE'}`);
    } catch (error) {
      console.error('Erreur mise à jour statut participant:', error);
    }
  }

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

  async notifyOfflineProfessionals(conversationId, messageData) {
    try {
      const offlineProfessionals = await query(`
        SELECT DISTINCT u.id, u.nom, u.prenom
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

      console.log(`${offlineProfessionals.length} professionnels hors ligne à notifier`);

      for (const professional of offlineProfessionals) {
        const shortMessage = messageData.message.length > 100 
          ? messageData.message.substring(0, 100) + '...' 
          : messageData.message;

        await query(`
          INSERT INTO notifications_users (user_id, type, titre, message, data)
          VALUES (?, 'client_nouveau', 'Nouveau message de chat', ?, ?)
        `, [
          professional.id,
          `Message de ${messageData.sender_nom} ${messageData.sender_prenom}: ${shortMessage}`,
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

  getConnectionStats() {
    const users = Array.from(this.connectedUsers.values());
    const clients = users.filter(u => u.userType === 'client');
    const professionals = users.filter(u => u.userType === 'user');
    
    return {
      totalConnected: this.connectedUsers.size,
      connectedClients: clients.length,
      connectedProfessionals: professionals.length,
      activeConversations: this.conversationRooms.size,
      clientsList: clients.map(c => c.userInfo.nom),
      professionalsList: professionals.map(p => `${p.userInfo.prenom} ${p.userInfo.nom} (${p.userInfo.role})`),
      // Stats de l'assistant
      assistantAmani: {
        enabled: assistantAmaniService?.isEnabled() || false,
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        active: professionals.length === 0 // Assistant actif si aucun professionnel connecté
      }
    };
  }

  broadcastSystemMessage(message, level = 'info') {
    if (this.io) {
      console.log(`Diffusion message système: ${message}`);
      this.io.emit('system_message', {
        message,
        level,
        timestamp: new Date()
      });
    }
  }

  disconnectUser(userType, userId, reason = 'Déconnexion administrative') {
    const userKey = `${userType}_${userId}`;
    const user = this.connectedUsers.get(userKey);
    
    if (user && user.socket) {
      console.log(`Déconnexion forcée: ${user.userInfo.nom} (${reason})`);
      user.socket.emit('forced_disconnect', { reason });
      user.socket.disconnect(true);
      this.connectedUsers.delete(userKey);
    }
  }

  cleanupInactiveConnections() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [userKey, userData] of this.connectedUsers.entries()) {
      const inactiveTime = now - userData.lastActivity.getTime();
      
      if (inactiveTime > 30 * 60 * 1000) {
        console.log(`Nettoyage connexion inactive: ${userData.userInfo.nom} (${Math.round(inactiveTime / 60000)} min)`);
        this.disconnectUser(userData.userType, userData.userId, 'Inactivité prolongée');
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`${cleanedCount} connexions inactives nettoyées`);
    }

    let roomsCleaned = 0;
    for (const [conversationId, socketIds] of this.conversationRooms.entries()) {
      if (socketIds.size === 0) {
        this.conversationRooms.delete(conversationId);
        roomsCleaned++;
      }
    }

    if (roomsCleaned > 0) {
      console.log(`${roomsCleaned} rooms vides supprimées`);
    }
  }

  getUserConnection(userType, userId) {
    const userKey = `${userType}_${userId}`;
    return this.connectedUsers.get(userKey) || null;
  }

  sendPrivateMessage(userType, userId, eventName, data) {
    const userKey = `${userType}_${userId}`;
    const user = this.connectedUsers.get(userKey);
    
    if (user && user.socket) {
      user.socket.emit(eventName, data);
      return true;
    }
    
    return false;
  }
}

const chatService = new ChatService();

module.exports = chatService;