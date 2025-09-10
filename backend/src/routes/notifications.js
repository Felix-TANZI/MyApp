const express = require('express');
const { verifyAuth } = require('../controllers/authController');
const { query } = require('../utils/auth');
const router = express.Router();

// Middleware d'authentification pour toutes les routes
router.use(verifyAuth);

// Fonction utilitaire pour parser le JSON de manière sécurisée
const safeJsonParse = (data) => {
  if (!data) return null;
  if (typeof data === 'object') return data; // Déjà un objet
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch (error) {
      console.warn('Erreur parsing JSON:', error.message, 'Data:', data);
      return null;
    }
  }
  return null;
};

// GET /api/notifications - Récupérer les notifications avec pagination et filtres
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.type;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 20));
    const unreadOnly = req.query.unreadOnly === 'true';
    const type = req.query.type || '';
    const offset = (page - 1) * limit;
    
    // Déterminer la table et les conditions
    const tableName = userType === 'user' ? 'notifications_users' : 'notifications_client';
    const userIdField = userType === 'user' ? 'user_id' : 'client_id';
    
    let whereConditions = [`${userIdField} = ?`];
    let queryParams = [userId];
    
    if (unreadOnly) {
      whereConditions.push('lu = FALSE');
    }
    
    if (type) {
      whereConditions.push('type = ?');
      queryParams.push(type);
    }
    
    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    
    // Compter le total
    const [countResult] = await query(`
      SELECT COUNT(*) as total FROM ${tableName} ${whereClause}
    `, queryParams);
    
    // Récupérer les notifications
    const notifications = await query(`
      SELECT 
        id, type, titre, message, data, lu, 
        date_creation, date_lecture
      FROM ${tableName} 
      ${whereClause}
      ORDER BY date_creation DESC 
      LIMIT ${limit} OFFSET ${offset}
    `, queryParams);
    
    // Compter les non lues
    const [unreadResult] = await query(`
      SELECT COUNT(*) as unread FROM ${tableName} 
      WHERE ${userIdField} = ? AND lu = FALSE
    `, [userId]);
    
    // Parser les données JSON de manière sécurisée
    const processedNotifications = notifications.map(notif => ({
      ...notif,
      data: safeJsonParse(notif.data)
    }));
    
    res.json({
      success: true,
      data: {
        notifications: processedNotifications,
        pagination: {
          page,
          limit,
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / limit),
          hasNext: page < Math.ceil(countResult.total / limit),
          hasPrev: page > 1
        },
        unread_count: unreadResult.unread
      }
    });

  } catch (error) {
    console.error('Erreur récupération notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des notifications'
    });
  }
};

// POST /api/notifications/send - Envoyer une notification (admin seulement)
const sendNotification = async (req, res) => {
  try {
    // Vérifier les permissions (admin seulement pour l'envoi manuel)
    if (req.user.type !== 'user' || !['admin'].includes(req.userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Permissions insuffisantes'
      });
    }

    const {
      targetType, // 'user', 'client', 'role', 'all'
      targetIds,  // Array d'IDs ou rôles
      type,
      titre,
      message,
      data
    } = req.body;

    // Validation
    if (!targetType || !type || !titre || !message) {
      return res.status(400).json({
        success: false,
        message: 'Données manquantes'
      });
    }

    const notificationService = req.notificationService;
    if (!notificationService) {
      return res.status(503).json({
        success: false,
        message: 'Service de notifications non disponible'
      });
    }

    const sentNotifications = [];

    switch (targetType) {
      case 'user':
        // Envoyer à des utilisateurs spécifiques
        if (Array.isArray(targetIds)) {
          for (const userId of targetIds) {
            const notifId = await notificationService.createAndSendNotification(
              'user', userId, { type, titre, message, data }
            );
            sentNotifications.push({ userId, notificationId: notifId });
          }
        }
        break;

      case 'client':
        // Envoyer à des clients spécifiques
        if (Array.isArray(targetIds)) {
          for (const clientId of targetIds) {
            const notifId = await notificationService.createAndSendNotification(
              'client', clientId, { type, titre, message, data }
            );
            sentNotifications.push({ clientId, notificationId: notifId });
          }
        }
        break;

      case 'role':
        // Envoyer à tous les utilisateurs d'un rôle
        const users = await query(`
          SELECT id FROM users 
          WHERE role IN (${targetIds.map(() => '?').join(',')}) 
          AND statut = 'actif'
        `, targetIds);

        for (const user of users) {
          const notifId = await notificationService.createAndSendNotification(
            'user', user.id, { type, titre, message, data }
          );
          sentNotifications.push({ userId: user.id, notificationId: notifId });
        }
        break;

      case 'all':
        // Envoyer à tous les utilisateurs actifs
        if (targetIds.includes('users')) {
          const allUsers = await query('SELECT id FROM users WHERE statut = "actif"');
          for (const user of allUsers) {
            const notifId = await notificationService.createAndSendNotification(
              'user', user.id, { type, titre, message, data }
            );
            sentNotifications.push({ userId: user.id, notificationId: notifId });
          }
        }
        
        if (targetIds.includes('clients')) {
          const allClients = await query('SELECT id FROM clients WHERE statut = "actif"');
          for (const client of allClients) {
            const notifId = await notificationService.createAndSendNotification(
              'client', client.id, { type, titre, message, data }
            );
            sentNotifications.push({ clientId: client.id, notificationId: notifId });
          }
        }
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Type de cible invalide'
        });
    }

    res.json({
      success: true,
      message: `${sentNotifications.length} notification(s) envoyée(s)`,
      data: { sentNotifications }
    });

  } catch (error) {
    console.error('Erreur envoi notification:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de l\'envoi'
    });
  }
};

// PUT /api/notifications/:id/read - Marquer comme lu
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userType = req.user.type;
    
    const tableName = userType === 'user' ? 'notifications_users' : 'notifications_client';
    const userIdField = userType === 'user' ? 'user_id' : 'client_id';
    
    const result = await query(`
      UPDATE ${tableName} 
      SET lu = TRUE, date_lecture = NOW() 
      WHERE id = ? AND ${userIdField} = ?
    `, [id, userId]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification introuvable'
      });
    }
    
    // Notifier via WebSocket si disponible
    if (req.notificationService) {
      req.notificationService.sendToUser(userType, userId, 'notification_marked_read', { 
        notificationId: parseInt(id) 
      });
    }
    
    res.json({
      success: true,
      message: 'Notification marquée comme lue'
    });

  } catch (error) {
    console.error('Erreur marquage notification:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors du marquage'
    });
  }
};

// PUT /api/notifications/mark-all-read - Marquer toutes comme lues
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.type;
    
    const tableName = userType === 'user' ? 'notifications_users' : 'notifications_client';
    const userIdField = userType === 'user' ? 'user_id' : 'client_id';
    
    const result = await query(`
      UPDATE ${tableName} 
      SET lu = TRUE, date_lecture = NOW() 
      WHERE ${userIdField} = ? AND lu = FALSE
    `, [userId]);
    
    // Notifier via WebSocket si disponible
    if (req.notificationService) {
      req.notificationService.sendToUser(userType, userId, 'all_notifications_marked_read', { 
        count: result.affectedRows 
      });
    }
    
    res.json({
      success: true,
      message: `${result.affectedRows} notification(s) marquée(s) comme lues`
    });

  } catch (error) {
    console.error('Erreur marquage toutes notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors du marquage'
    });
  }
};

// DELETE /api/notifications/:id - Supprimer une notification
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userType = req.user.type;
    
    const tableName = userType === 'user' ? 'notifications_users' : 'notifications_client';
    const userIdField = userType === 'user' ? 'user_id' : 'client_id';
    
    const result = await query(`
      DELETE FROM ${tableName} 
      WHERE id = ? AND ${userIdField} = ?
    `, [id, userId]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification introuvable'
      });
    }
    
    // Notifier via WebSocket si disponible
    if (req.notificationService) {
      req.notificationService.sendToUser(userType, userId, 'notification_deleted', { 
        notificationId: parseInt(id) 
      });
    }
    
    res.json({
      success: true,
      message: 'Notification supprimée'
    });

  } catch (error) {
    console.error('Erreur suppression notification:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la suppression'
    });
  }
};

// DELETE /api/notifications/clear-all - Supprimer toutes les notifications
const clearAllNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.type;
    const { onlyRead = false } = req.query;
    
    const tableName = userType === 'user' ? 'notifications_users' : 'notifications_client';
    const userIdField = userType === 'user' ? 'user_id' : 'client_id';
    
    let whereClause = `WHERE ${userIdField} = ?`;
    let queryParams = [userId];
    
    if (onlyRead === 'true') {
      whereClause += ' AND lu = TRUE';
    }
    
    const result = await query(`
      DELETE FROM ${tableName} ${whereClause}
    `, queryParams);
    
    // Notifier via WebSocket si disponible
    if (req.notificationService) {
      req.notificationService.sendToUser(userType, userId, 'notifications_cleared', { 
        count: result.affectedRows,
        onlyRead: onlyRead === 'true'
      });
    }
    
    res.json({
      success: true,
      message: `${result.affectedRows} notification(s) supprimée(s)`
    });

  } catch (error) {
    console.error('Erreur suppression toutes notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la suppression'
    });
  }
};

// GET /api/notifications/stats - Statistiques des notifications
const getNotificationStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.type;
    
    const tableName = userType === 'user' ? 'notifications_users' : 'notifications_client';
    const userIdField = userType === 'user' ? 'user_id' : 'client_id';
    
    const stats = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN lu = FALSE THEN 1 END) as unread,
        COUNT(CASE WHEN lu = TRUE THEN 1 END) as read,
        COUNT(CASE WHEN date_creation >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as today,
        COUNT(CASE WHEN date_creation >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as this_week,
        COUNT(CASE WHEN type = 'facture_nouvelle' THEN 1 END) as factures,
        COUNT(CASE WHEN type = 'paiement_recu' THEN 1 END) as paiements,
        COUNT(CASE WHEN type = 'system' THEN 1 END) as system,
        MAX(date_creation) as derniere_notification
      FROM ${tableName} 
      WHERE ${userIdField} = ?
    `, [userId]);
    
    // Statistiques par type
    const typeStats = await query(`
      SELECT 
        type,
        COUNT(*) as count,
        COUNT(CASE WHEN lu = FALSE THEN 1 END) as unread_count
      FROM ${tableName} 
      WHERE ${userIdField} = ?
      GROUP BY type
      ORDER BY count DESC
    `, [userId]);
    
    res.json({
      success: true,
      data: {
        global: stats[0],
        by_type: typeStats
      }
    });

  } catch (error) {
    console.error('Erreur statistiques notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des statistiques'
    });
  }
};

// GET /api/notifications/system/stats - Statistiques système (admin seulement)
const getSystemStats = async (req, res) => {
  try {
    // Vérifier les permissions admin
    if (req.user.type !== 'user' || !['admin'].includes(req.userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Permissions insuffisantes'
      });
    }

    const connectionStats = req.notificationService ? 
      req.notificationService.getConnectionStats() : 
      { connectedUsers: 0, connectedClients: 0, totalSockets: 0 };
    
    // Statistiques globales notifications
    const globalStats = await query(`
      SELECT 
        'users' as target_type,
        COUNT(*) as total_notifications,
        COUNT(CASE WHEN lu = FALSE THEN 1 END) as unread_notifications,
        COUNT(DISTINCT user_id) as users_with_notifications
      FROM notifications_users
      
      UNION ALL
      
      SELECT 
        'clients' as target_type,
        COUNT(*) as total_notifications,
        COUNT(CASE WHEN lu = FALSE THEN 1 END) as unread_notifications,
        COUNT(DISTINCT client_id) as users_with_notifications
      FROM notifications_client
    `);
    
    // Sessions WebSocket actives (optionnel)
    let activeSessions = [];
    try {
      activeSessions = await query(`
        SELECT 
          user_type,
          COUNT(*) as active_sessions,
          COUNT(DISTINCT CASE WHEN user_type = 'user' THEN user_id ELSE client_id END) as unique_users
        FROM websocket_sessions 
        WHERE is_active = TRUE
        GROUP BY user_type
      `);
    } catch (error) {
      console.log('Table websocket_sessions non disponible');
    }
    
    res.json({
      success: true,
      data: {
        connections: connectionStats,
        notifications: globalStats,
        websocket_sessions: activeSessions
      }
    });

  } catch (error) {
    console.error('Erreur statistiques système:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des statistiques système'
    });
  }
};

// Configuration des routes
router.get('/', getNotifications);
router.post('/send', sendNotification);
router.put('/:id/read', markAsRead);
router.put('/mark-all-read', markAllAsRead);
router.delete('/:id', deleteNotification);
router.delete('/clear-all', clearAllNotifications);
router.get('/stats', getNotificationStats);
router.get('/system/stats', getSystemStats);

module.exports = router;