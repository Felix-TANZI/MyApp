// src/hooks/useNotifications.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const useNotifications = (user, userType) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);

  // Initialiser la connexion WebSocket
  const initializeSocket = useCallback(() => {
    if (!user || socketRef.current) return;

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    console.log('🔌 Connexion WebSocket notifications...');

    socketRef.current = io(process.env.REACT_APP_API_URL || 'http://localhost:5000', {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: false
    });

    const socket = socketRef.current;

    // Événements de connexion
    socket.on('connect', () => {
      console.log('✅ WebSocket connecté:', socket.id);
      setIsConnected(true);
      setError(null);
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket déconnecté:', reason);
      setIsConnected(false);
      if (reason === 'io server disconnect') {
        // Reconnexion automatique si le serveur ferme la connexion
        socket.connect();
      }
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Erreur connexion WebSocket:', error);
      setError(error.message);
      setIsConnected(false);
    });

    // Événements notifications
    socket.on('new_notification', (notification) => {
      console.log('🔔 Nouvelle notification reçue:', notification);
      
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      // Optionnel : Afficher une notification native du navigateur
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.titre, {
          body: notification.message,
          icon: '/favicon.ico',
          tag: `notification-${notification.id}`
        });
      }
    });

    socket.on('unread_notifications', (data) => {
      console.log('📬 Notifications non lues reçues:', data);
      setNotifications(prev => {
        const existingIds = new Set(prev.map(n => n.id));
        const newNotifications = data.notifications.filter(n => !existingIds.has(n.id));
        return [...newNotifications, ...prev];
      });
      setUnreadCount(data.count);
    });

    socket.on('notifications_list', (data) => {
      console.log('📋 Liste notifications reçue:', data);
      setNotifications(data.notifications);
    });

    socket.on('notification_marked_read', (data) => {
      console.log('✅ Notification marquée comme lue:', data.notificationId);
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === data.notificationId 
            ? { ...notif, lu: true, date_lecture: new Date().toISOString() }
            : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    });

    socket.on('all_notifications_marked_read', (data) => {
      console.log('✅ Toutes notifications marquées comme lues:', data.count);
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, lu: true, date_lecture: new Date().toISOString() }))
      );
      setUnreadCount(0);
    });

    socket.on('notification_deleted', (data) => {
      console.log('🗑️ Notification supprimée:', data.notificationId);
      setNotifications(prev => 
        prev.filter(notif => notif.id !== data.notificationId)
      );
      // Recalculer le compteur non lu
      setUnreadCount(prev => {
        const deletedNotif = notifications.find(n => n.id === data.notificationId);
        return deletedNotif && !deletedNotif.lu ? Math.max(0, prev - 1) : prev;
      });
    });

    socket.on('notifications_cleared', (data) => {
      console.log('🧹 Notifications supprimées:', data);
      if (data.onlyRead) {
        setNotifications(prev => prev.filter(notif => !notif.lu));
      } else {
        setNotifications([]);
        setUnreadCount(0);
      }
    });

    socket.on('error', (error) => {
      console.error('❌ Erreur WebSocket:', error);
      setError(error.message);
    });

    // Ping périodique pour maintenir la connexion
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('ping');
      }
    }, 30000);

    socket.on('pong', () => {
      // Connexion toujours active
    });

    // Nettoyer l'intervalle à la déconnexion
    socket.on('disconnect', () => {
      clearInterval(pingInterval);
    });

  }, [user, notifications]);

  // Fermer la connexion
  const closeSocket = useCallback(() => {
    if (socketRef.current) {
      console.log('🔌 Fermeture connexion WebSocket');
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  // Marquer une notification comme lue
  const markAsRead = useCallback(async (notificationId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors du marquage');
      }

      // La mise à jour se fera via WebSocket
    } catch (error) {
      console.error('Erreur marquage notification:', error);
      setError('Impossible de marquer la notification comme lue');
    }
  }, []);

  // Marquer toutes les notifications comme lues
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5000/api/notifications/mark-all-read', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors du marquage');
      }

      // La mise à jour se fera via WebSocket
    } catch (error) {
      console.error('Erreur marquage toutes notifications:', error);
      setError('Impossible de marquer toutes les notifications comme lues');
    }
  }, []);

  // Supprimer une notification
  const deleteNotification = useCallback(async (notificationId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la suppression');
      }

      // La mise à jour se fera via WebSocket
    } catch (error) {
      console.error('Erreur suppression notification:', error);
      setError('Impossible de supprimer la notification');
    }
  }, []);

  // Supprimer toutes les notifications
  const clearAllNotifications = useCallback(async (onlyRead = false) => {
    try {
      const response = await fetch(`http://localhost:5000/api/notifications/clear-all?onlyRead=${onlyRead}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la suppression');
      }

      // La mise à jour se fera via WebSocket
    } catch (error) {
      console.error('Erreur suppression toutes notifications:', error);
      setError('Impossible de supprimer les notifications');
    }
  }, []);

  // Charger les notifications avec pagination
  const loadNotifications = useCallback(async (page = 1, limit = 20, unreadOnly = false) => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        unreadOnly: unreadOnly.toString()
      });

      const response = await fetch(`http://localhost:5000/api/notifications?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors du chargement');
      }

      const data = await response.json();
      
      if (page === 1) {
        setNotifications(data.data.notifications);
      } else {
        setNotifications(prev => [...prev, ...data.data.notifications]);
      }
      
      setUnreadCount(data.data.unread_count);
      return data.data;
    } catch (error) {
      console.error('Erreur chargement notifications:', error);
      setError('Impossible de charger les notifications');
      return null;
    }
  }, []);

  // Demander les permissions de notification native
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  }, []);

  // Envoyer une notification (admin seulement)
  const sendNotification = useCallback(async (notificationData) => {
    try {
      const response = await fetch('http://localhost:5000/api/notifications/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(notificationData)
      });

      if (!response.ok) {
        throw new Error('Erreur lors de l\'envoi');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Erreur envoi notification:', error);
      setError('Impossible d\'envoyer la notification');
      return null;
    }
  }, []);

  // Effets
  useEffect(() => {
    if (user) {
      initializeSocket();
    }

    return () => {
      closeSocket();
    };
  }, [user, initializeSocket, closeSocket]);

  // Charger les notifications initiales
  useEffect(() => {
    if (user && isConnected) {
      loadNotifications(1, 20);
    }
  }, [user, isConnected, loadNotifications]);

  // Nettoyer les erreurs après 5 secondes
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return {
    // État
    notifications,
    unreadCount,
    isConnected,
    error,
    
    // Actions
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    loadNotifications,
    sendNotification,
    requestNotificationPermission,
    
    // Utilitaires
    closeSocket
  };
};

export default useNotifications;