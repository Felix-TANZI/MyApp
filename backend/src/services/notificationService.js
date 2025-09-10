const { query } = require('../utils/auth');
const jwt = require('jsonwebtoken');

class NotificationService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // Map: userId -> Set of socket IDs
    this.connectedClients = new Map(); // Map: clientId -> Set of socket IDs
  }

  /**
   * Initialiser le service avec l'instance Socket.io
   */
  initialize(io) {
    this.io = io;
    this.setupSocketHandlers();
    this.startCleanupScheduler();
    
    console.log('🔔 Service de notifications initialisé');
  }

  /**
   * Configuration des gestionnaires Socket.io
   */
  setupSocketHandlers() {
    this.io.use(async (socket, next) => {
      try {
        // Authentification du socket
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        
        if (!token) {
          return next(new Error('Token manquant'));
        }

        // Vérifier le token JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userType = decoded.userType;
        const userId = decoded.userId;

        // Vérifier que l'utilisateur existe toujours
        let userExists = false;
        if (userType === 'user') {
          const users = await query('SELECT id, statut FROM users WHERE id = ? AND statut = "actif"', [userId]);
          userExists = users.length > 0;
        } else if (userType === 'client') {
          const clients = await query('SELECT id, statut FROM clients WHERE id = ? AND statut = "actif"', [userId]);
          userExists = clients.length > 0;
        }

        if (!userExists) {
          return next(new Error('Utilisateur introuvable ou inactif'));
        }

        // Attacher les infos à la socket
        socket.userType = userType;
        socket.userId = userId;
        socket.authenticated = true;

        next();
      } catch (error) {
        console.error('Erreur authentification socket:', error);
        next(new Error('Token invalide'));
      }
    });

    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * Gérer une nouvelle connexion
   */
  async handleConnection(socket) {
    try {
      const { userType, userId } = socket;
      
      console.log(`🔗 Nouvelle connexion: ${userType} ${userId} (socket: ${socket.id})`);

      // Ajouter à la map des connexions
      if (userType === 'user') {
        if (!this.connectedUsers.has(userId)) {
          this.connectedUsers.set(userId, new Set());
        }
        this.connectedUsers.get(userId).add(socket.id);
      } else if (userType === 'client') {
        if (!this.connectedClients.has(userId)) {
          this.connectedClients.set(userId, new Set());
        }
        this.connectedClients.get(userId).add(socket.id);
      }

      // Enregistrer la session dans la base
      await this.saveSocketSession(socket);

      // Joindre les rooms appropriées
      socket.join(`${userType}_${userId}`);
      if (userType === 'user') {
        socket.join('staff'); // Room pour tout le personnel
      } else {
        socket.join('clients'); // Room pour tous les clients
      }

      // Envoyer les notifications non lues
      await this.sendUnreadNotifications(socket);

      // Gestionnaires d'événements
      socket.on('mark_notification_read', (data) => this.handleMarkAsRead(socket, data));
      socket.on('get_notifications', (data) => this.handleGetNotifications(socket, data));
      socket.on('ping', () => this.handlePing(socket));
      
      socket.on('disconnect', () => this.handleDisconnection(socket));

    } catch (error) {
      console.error('Erreur lors de la connexion:', error);
      socket.emit('error', { message: 'Erreur de connexion' });
    }
  }

  /**
   * Gérer la déconnexion
   */
  async handleDisconnection(socket) {
    try {
      const { userType, userId } = socket;
      
      console.log(`❌ Déconnexion: ${userType} ${userId} (socket: ${socket.id})`);

      // Retirer de la map des connexions
      if (userType === 'user' && this.connectedUsers.has(userId)) {
        this.connectedUsers.get(userId).delete(socket.id);
        if (this.connectedUsers.get(userId).size === 0) {
          this.connectedUsers.delete(userId);
        }
      } else if (userType === 'client' && this.connectedClients.has(userId)) {
        this.connectedClients.get(userId).delete(socket.id);
        if (this.connectedClients.get(userId).size === 0) {
          this.connectedClients.delete(userId);
        }
      }

      // Marquer la session comme inactive
      await query(
        'UPDATE websocket_sessions SET is_active = FALSE WHERE socket_id = ?',
        [socket.id]
      );

    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  }

  /**
   * Sauvegarder la session socket en base
   */
  async saveSocketSession(socket) {
    try {
      const { userType, userId } = socket;
      const userAgent = socket.handshake.headers['user-agent'] || '';
      const ipAddress = socket.handshake.address || socket.handshake.headers['x-forwarded-for'] || 'unknown';

      if (userType === 'user') {
        await query(`
          INSERT INTO websocket_sessions (user_id, user_type, socket_id, user_agent, ip_address)
          VALUES (?, ?, ?, ?, ?)
        `, [userId, userType, socket.id, userAgent, ipAddress]);
      } else {
        await query(`
          INSERT INTO websocket_sessions (client_id, user_type, socket_id, user_agent, ip_address)
          VALUES (?, ?, ?, ?, ?)
        `, [userId, userType, socket.id, userAgent, ipAddress]);
      }
    } catch (error) {
      console.error('Erreur sauvegarde session:', error);
    }
  }

  /**
   * Envoyer les notifications non lues
   */
  async sendUnreadNotifications(socket) {
    try {
      const { userType, userId } = socket;
      let notifications = [];

      if (userType === 'user') {
        notifications = await query(`
          SELECT id, type, titre, message, data, date_creation
          FROM notifications_users 
          WHERE user_id = ? AND lu = FALSE 
          ORDER BY date_creation DESC 
          LIMIT 10
        `, [userId]);
      } else {
        notifications = await query(`
          SELECT id, type, titre, message, data, date_creation
          FROM notifications_client 
          WHERE client_id = ? AND lu = FALSE 
          ORDER BY date_creation DESC 
          LIMIT 10
        `, [userId]);
      }

      if (notifications.length > 0) {
        socket.emit('unread_notifications', {
          notifications,
          count: notifications.length
        });
      }
    } catch (error) {
      console.error('Erreur envoi notifications non lues:', error);
    }
  }

  /**
   * Marquer une notification comme lue
   */
  async handleMarkAsRead(socket, data) {
    try {
      const { userType, userId } = socket;
      const { notificationId } = data;

      if (userType === 'user') {
        await query(`
          UPDATE notifications_users 
          SET lu = TRUE, date_lecture = NOW() 
          WHERE id = ? AND user_id = ?
        `, [notificationId, userId]);
      } else {
        await query(`
          UPDATE notifications_client 
          SET lu = TRUE, date_lecture = NOW() 
          WHERE id = ? AND client_id = ?
        `, [notificationId, userId]);
      }

      socket.emit('notification_marked_read', { notificationId });
    } catch (error) {
      console.error('Erreur marquage comme lu:', error);
      socket.emit('error', { message: 'Erreur lors du marquage' });
    }
  }

  /**
   * Récupérer les notifications avec pagination
   */
  async handleGetNotifications(socket, data) {
    try {
      const { userType, userId } = socket;
      const { page = 1, limit = 20, unreadOnly = false } = data;
      const offset = (page - 1) * limit;

      let whereClause = '';
      let queryParams = [];

      if (userType === 'user') {
        whereClause = 'WHERE user_id = ?';
        queryParams = [userId];
      } else {
        whereClause = 'WHERE client_id = ?';
        queryParams = [userId];
      }

      if (unreadOnly) {
        whereClause += ' AND lu = FALSE';
      }

      const tableName = userType === 'user' ? 'notifications_users' : 'notifications_client';

      const notifications = await query(`
        SELECT id, type, titre, message, data, lu, date_creation
        FROM ${tableName} 
        ${whereClause}
        ORDER BY date_creation DESC 
        LIMIT ${limit} OFFSET ${offset}
      `, queryParams);

      // Compter le total
      const [countResult] = await query(`
        SELECT COUNT(*) as total FROM ${tableName} ${whereClause}
      `, queryParams);

      socket.emit('notifications_list', {
        notifications,
        pagination: {
          page,
          limit,
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / limit)
        }
      });
    } catch (error) {
      console.error('Erreur récupération notifications:', error);
      socket.emit('error', { message: 'Erreur lors de la récupération' });
    }
  }

  /**
   * Gérer le ping pour maintenir la connexion
   */
  async handlePing(socket) {
    try {
      await query(
        'UPDATE websocket_sessions SET last_ping = NOW() WHERE socket_id = ?',
        [socket.id]
      );
      socket.emit('pong');
    } catch (error) {
      console.error('Erreur ping:', error);
    }
  }

  /**
   * Créer et envoyer une notification en temps réel
   */
  async createAndSendNotification(targetType, targetId, notificationData) {
    try {
      const { type, titre, message, data = null } = notificationData;
      let notificationId;

      // Créer la notification en base
      if (targetType === 'user') {
        const result = await query(`
          INSERT INTO notifications_users (user_id, type, titre, message, data)
          VALUES (?, ?, ?, ?, ?)
        `, [targetId, type, titre, message, JSON.stringify(data)]);
        notificationId = result.insertId;
      } else if (targetType === 'client') {
        const result = await query(`
          INSERT INTO notifications_client (client_id, type, titre, message, data)
          VALUES (?, ?, ?, ?, ?)
        `, [targetId, type, titre, message, JSON.stringify(data)]);
        notificationId = result.insertId;
      }

      // Envoyer en temps réel si l'utilisateur est connecté
      const notification = {
        id: notificationId,
        type,
        titre,
        message,
        data,
        lu: false,
        date_creation: new Date().toISOString()
      };

      this.sendToUser(targetType, targetId, 'new_notification', notification);

      return notificationId;
    } catch (error) {
      console.error('Erreur création notification:', error);
      throw error;
    }
  }

  /**
   * Envoyer un message à un utilisateur spécifique
   */
  sendToUser(userType, userId, event, data) {
    this.io.to(`${userType}_${userId}`).emit(event, data);
  }

  /**
   * Envoyer un message à tous les utilisateurs d'un type
   */
  sendToAllUsers(userType, event, data) {
    const roomName = userType === 'user' ? 'staff' : 'clients';
    this.io.to(roomName).emit(event, data);
  }

  /**
   * Envoyer un message à tous les utilisateurs selon leur rôle
   */
  async sendToRole(roles, event, data) {
    try {
      const users = await query(`
        SELECT id FROM users 
        WHERE role IN (${roles.map(() => '?').join(',')}) 
        AND statut = 'actif'
      `, roles);

      users.forEach(user => {
        this.sendToUser('user', user.id, event, data);
      });
    } catch (error) {
      console.error('Erreur envoi par rôle:', error);
    }
  }

  /**
   * Programmer le nettoyage automatique des sessions
   */
  startCleanupScheduler() {
    const cron = require('node-cron');
    
    // Nettoyer toutes les 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      try {
        await query('CALL CleanupInactiveSessions()');
        console.log('🧹 Sessions nettoyées automatiquement');
      } catch (error) {
        console.error('Erreur nettoyage automatique:', error);
      }
    });
  }

  /**
   * Obtenir les statistiques de connexions
   */
  getConnectionStats() {
    return {
      connectedUsers: this.connectedUsers.size,
      connectedClients: this.connectedClients.size,
      totalSockets: Array.from(this.connectedUsers.values()).reduce((sum, set) => sum + set.size, 0) +
                   Array.from(this.connectedClients.values()).reduce((sum, set) => sum + set.size, 0)
    };
  }

  /**
   * Vérifier si un utilisateur est en ligne
   */
  isUserOnline(userType, userId) {
    if (userType === 'user') {
      return this.connectedUsers.has(userId);
    } else {
      return this.connectedClients.has(userId);
    }
  }
}

// Instance singleton
const notificationService = new NotificationService();

module.exports = notificationService;