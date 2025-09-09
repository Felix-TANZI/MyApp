// src/hooks/useNotifications.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const useNotifications = (user, userType) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const isInitializingRef = useRef(false);

  // Fonction de nettoyage
  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (socketRef.current) {
      console.log('🔌 Fermeture connexion WebSocket');
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      isInitializingRef.current = false;
    }
  }, []);

  // Initialiser la connexion WebSocket
  const initializeSocket = useCallback(() => {
    // Éviter les initialisations multiples
    if (!user || isInitializingRef.current || socketRef.current) {
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.log('❌ Pas de token, connexion WebSocket annulée');
      return;
    }

    isInitializingRef.current = true;
    console.log('🔌 Connexion WebSocket notifications...');

    try {
      socketRef.current = io(process.env.REACT_APP_API_URL || 'http://localhost:5000', {
        auth: { token },
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: false,
        autoConnect: true,
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        maxReconnectionAttempts: 5
      });

      const socket = socketRef.current;

      // Événements de connexion
      socket.on('connect', () => {
        console.log('✅ WebSocket connecté:', socket.id);
        setIsConnected(true);
        setError(null);
        isInitializingRef.current = false;
      });

      socket.on('disconnect', (reason) => {
        console.log('❌ WebSocket déconnecté:', reason);
        setIsConnected(false);
        
        // Ne pas reconnecter automatiquement si c'est intentionnel
        if (reason === 'io client disconnect') {
          console.log('Déconnexion intentionnelle');
          return;
        }
        
        // Reconnexion automatique avec délai
        if (reason === 'io server disconnect') {
          reconnectTimeoutRef.current = setTimeout(() => {
            if (socketRef.current && !socketRef.current.connected) {
              console.log('Tentative de reconnexion...');
              socket.connect();
            }
          }, 3000);
        }
      });

      socket.on('connect_error', (error) => {
        console.error('❌ Erreur connexion WebSocket:', error.message);
        setError(error.message);
        setIsConnected(false);
        isInitializingRef.current = false;
      });

      // Événements notifications
      socket.on('new_notification', (notification) => {
        console.log('🔔 Nouvelle notification reçue:', notification);
        
        setNotifications(prev => {
          // Éviter les doublons
          const exists = prev.some(n => n.id === notification.id);
          if (exists) return prev;
          return [notification, ...prev];
        });
        
        setUnreadCount(prev => prev + 1);
        
        // Notification native du navigateur
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
        if (data.notifications && Array.isArray(data.notifications)) {
          setNotifications(prev => {
            const existingIds = new Set(prev.map(n => n.id));
            const newNotifications = data.notifications.filter(n => !existingIds.has(n.id));
            return [...newNotifications, ...prev];
          });
          setUnreadCount(data.count || 0);
        }
      });

      socket.on('notifications_list', (data) => {
        console.log('📋 Liste notifications reçue:', data);
        if (data.notifications && Array.isArray(data.notifications)) {
          setNotifications(data.notifications);
        }
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
        setNotifications(prev => {
          const deletedNotif = prev.find(n => n.id === data.notificationId);
          const filtered = prev.filter(notif => notif.id !== data.notificationId);
          
          // Ajuster le compteur si la notification supprimée était non lue
          if (deletedNotif && !deletedNotif.lu) {
            setUnreadCount(current => Math.max(0, current - 1));
          }
          
          return filtered;
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
        setError(error.message || 'Erreur de connexion');
      });

      // Ping périodique plus intelligent
      const pingInterval = setInterval(() => {
        if (socket.connected) {
          socket.emit('ping');
        }
      }, 45000); // Toutes les 45 secondes

      socket.on('pong', () => {
        // Connexion active confirmée
      });

      // Nettoyer l'intervalle à la déconnexion
      socket.on('disconnect', () => {
        clearInterval(pingInterval);
      });

    } catch (error) {
      console.error('Erreur initialisation socket:', error);
      setError('Impossible d\'initialiser les notifications');
      isInitializingRef.current = false;
    }
  }, [user]);

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
        setNotifications(data.data.notifications || []);
      } else {
        setNotifications(prev => [...prev, ...(data.data.notifications || [])]);
      }
      
      setUnreadCount(data.data.unread_count || 0);
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

  // Fermer la connexion
  const closeSocket = useCallback(() => {
    cleanup();
  }, [cleanup]);

  // Effet principal
  useEffect(() => {
    if (user) {
      // Délai pour éviter les initialisations multiples rapides
      const timer = setTimeout(() => {
        initializeSocket();
      }, 100);

      return () => {
        clearTimeout(timer);
      };
    } else {
      cleanup();
    }
  }, [user, initializeSocket, cleanup]);

  // Charger les notifications initiales une seule fois
  useEffect(() => {
    if (user && isConnected && notifications.length === 0) {
      loadNotifications(1, 20);
    }
  }, [user, isConnected]);

  // Nettoyer les erreurs après 5 secondes
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

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
    requestNotificationPermission,
    
    // Utilitaires
    closeSocket
  };
};

export default useNotifications;