import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_WS_URL || 'http://localhost:5000';

const useChat = (user, userType) => {
  const [isConnected, setIsConnected] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);

  // Initialisation du socket
  const initializeSocket = useCallback(() => {
    if (!user || socketRef.current?.connected) return;

    console.log('🔌 Initialisation du socket chat...');

    socketRef.current = io(`${SOCKET_URL}/chat`, {
      transports: ['websocket', 'polling'],
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      maxReconnectionAttempts: 5
    });

    const socket = socketRef.current;

    // Événements de connexion
    socket.on('connect', () => {
      console.log('✅ Chat connecté:', socket.id);
      setIsConnected(true);
      setError(null);
      reconnectAttemptsRef.current = 0;

      // Authentification
      const token = localStorage.getItem('accessToken');
      socket.emit('authenticate', { token });
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Chat déconnecté:', reason);
      setIsConnected(false);
      setParticipants([]);
      setTypingUsers([]);
    });

    socket.on('connect_error', (error) => {
      console.error('Erreur connexion chat:', error);
      setError('Erreur de connexion au chat');
      setIsConnected(false);
      
      reconnectAttemptsRef.current++;
      if (reconnectAttemptsRef.current >= 5) {
        setError('Impossible de se connecter au chat. Vérifiez votre connexion.');
      }
    });

    // Événements d'authentification
    socket.on('authenticated', (data) => {
      console.log('🔐 Chat authentifié:', data);
      setError(null);
    });

    socket.on('auth_error', (error) => {
      console.error('Erreur auth chat:', error);
      setError('Erreur d\'authentification du chat');
      setIsConnected(false);
    });

    // Événements de conversation
    socket.on('conversation_joined', (data) => {
      console.log('🏠 Conversation rejointe:', data);
      setParticipants(data.onlineParticipants || []);
    });

    socket.on('user_joined', (data) => {
      console.log('👤 Utilisateur rejoint:', data);
      setParticipants(prev => {
        const exists = prev.find(p => p.user_id === data.userId && p.user_type === data.userType);
        if (exists) return prev;
        return [...prev, {
          user_id: data.userId,
          user_type: data.userType,
          nom: data.userInfo.nom,
          prenom: data.userInfo.prenom,
          role: data.userInfo.role || 'Client',
          en_ligne: true
        }];
      });
    });

    socket.on('user_left', (data) => {
      console.log('👋 Utilisateur parti:', data);
      setParticipants(prev => 
        prev.map(p => 
          p.user_id === data.userId && p.user_type === data.userType 
            ? { ...p, en_ligne: false }
            : p
        )
      );
    });

    // Événements de messages
    socket.on('new_message', (messageData) => {
      console.log('💬 Nouveau message:', messageData);
      setMessages(prev => [...prev, messageData]);
      
      // Mettre à jour la conversation si c'est la conversation courante
      if (currentConversation && messageData.conversation_id === currentConversation.id) {
        setCurrentConversation(prev => ({
          ...prev,
          dernier_message: messageData.message,
          date_dernier_message: messageData.date_creation
        }));
      }
      
      // Mettre à jour la liste des conversations
      setConversations(prev => prev.map(conv => 
        conv.id === messageData.conversation_id 
          ? {
              ...conv,
              dernier_message: messageData.message,
              date_dernier_message: messageData.date_creation,
              derniere_activite: messageData.date_creation
            }
          : conv
      ));
    });

    socket.on('messages_read', (data) => {
      console.log('✅ Messages lus:', data);
      // Marquer les messages comme lus visuellement si nécessaire
    });

    // Événements de frappe
    socket.on('user_typing', (data) => {
      if (data.isTyping) {
        setTypingUsers(prev => {
          const exists = prev.find(u => u.userId === data.userId && u.userType === data.userType);
          if (exists) return prev;
          return [...prev, data];
        });
      } else {
        setTypingUsers(prev => 
          prev.filter(u => !(u.userId === data.userId && u.userType === data.userType))
        );
      }
    });

    // Événements d'erreur
    socket.on('error', (error) => {
      console.error('Erreur chat:', error);
      setError(error.message);
    });

    // Connecter le socket
    socket.connect();

  }, [user, userType, currentConversation]);

  // Fermeture du socket
  const closeSocket = useCallback(() => {
    if (socketRef.current) {
      console.log('🔌 Fermeture du socket chat');
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setIsConnected(false);
    setParticipants([]);
    setTypingUsers([]);
  }, []);

  // Charger les conversations
  const loadConversations = useCallback(async (page = 1, search = '', status = '') => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        search,
        statut: status
      });

      const response = await fetch(`http://localhost:5000/api/chat/conversations?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Erreur lors du chargement des conversations');

      const data = await response.json();
      if (page === 1) {
        setConversations(data.data.conversations);
      } else {
        setConversations(prev => [...prev, ...data.data.conversations]);
      }

      // Calculer les messages non lus
      const totalUnread = data.data.conversations.reduce((total, conv) => {
        return total + (userType === 'client' ? conv.messages_non_lus_client : conv.messages_non_lus_professionnels);
      }, 0);
      setUnreadCount(totalUnread);

      return data.data;
    } catch (error) {
      console.error('Erreur chargement conversations:', error);
      setError(error.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [userType]);

  // Créer une nouvelle conversation (client uniquement)
  const createConversation = useCallback(async (sujet = 'Support général') => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/chat/conversations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sujet })
      });

      if (!response.ok) throw new Error('Erreur lors de la création de la conversation');

      const data = await response.json();
      if (data.success) {
        // Recharger les conversations
        await loadConversations();
        return data.data;
      }
      throw new Error(data.message);
    } catch (error) {
      console.error('Erreur création conversation:', error);
      setError(error.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [loadConversations]);

  // Rejoindre une conversation
  const joinConversation = useCallback(async (conversationId) => {
    try {
      setLoading(true);
      
      // Charger les détails de la conversation
      const response = await fetch(`http://localhost:5000/api/chat/conversations/${conversationId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Conversation introuvable');

      const convData = await response.json();
      setCurrentConversation(convData.data);

      // Charger les messages
      await loadMessages(conversationId);

      // Rejoindre via WebSocket
      if (socketRef.current?.connected) {
        socketRef.current.emit('join_conversation', { conversationId });
      }

      return convData.data;
    } catch (error) {
      console.error('Erreur rejoindre conversation:', error);
      setError(error.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Quitter une conversation
  const leaveConversation = useCallback(() => {
    if (currentConversation && socketRef.current?.connected) {
      socketRef.current.emit('leave_conversation', { 
        conversationId: currentConversation.id 
      });
    }
    
    setCurrentConversation(null);
    setMessages([]);
    setParticipants([]);
    setTypingUsers([]);
  }, [currentConversation]);

  // Charger les messages d'une conversation
  const loadMessages = useCallback(async (conversationId, page = 1) => {
    try {
      const response = await fetch(`http://localhost:5000/api/chat/conversations/${conversationId}/messages?page=${page}&limit=50`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Erreur lors du chargement des messages');

      const data = await response.json();
      if (page === 1) {
        setMessages(data.data.messages);
      } else {
        setMessages(prev => [...data.data.messages, ...prev]);
      }

      return data.data;
    } catch (error) {
      console.error('Erreur chargement messages:', error);
      setError(error.message);
      return null;
    }
  }, []);

  // Envoyer un message
  const sendMessage = useCallback((message, type = 'text') => {
    if (!currentConversation || !socketRef.current?.connected || !message.trim()) {
      return false;
    }

    socketRef.current.emit('send_message', {
      conversationId: currentConversation.id,
      message: message.trim(),
      type
    });

    return true;
  }, [currentConversation]);

  // Marquer les messages comme lus
  const markMessagesAsRead = useCallback((conversationId) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('mark_messages_read', { conversationId });
    }
  }, []);

  // Indicateur de frappe
  const startTyping = useCallback(() => {
    if (currentConversation && socketRef.current?.connected) {
      socketRef.current.emit('typing_start', { 
        conversationId: currentConversation.id 
      });
    }
  }, [currentConversation]);

  const stopTyping = useCallback(() => {
    if (currentConversation && socketRef.current?.connected) {
      socketRef.current.emit('typing_stop', { 
        conversationId: currentConversation.id 
      });
    }
  }, [currentConversation]);

  // Gérer la frappe avec délai automatique
  const handleTyping = useCallback(() => {
    startTyping();
    
    // Arrêter la frappe après 3 secondes d'inactivité
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, [startTyping, stopTyping]);

  // Fermer une conversation (professionnels uniquement)
  const closeConversation = useCallback(async (conversationId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/chat/conversations/${conversationId}/close`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Erreur lors de la fermeture');

      const data = await response.json();
      if (data.success) {
        // Recharger les conversations
        await loadConversations();
        
        // Si c'est la conversation courante, la quitter
        if (currentConversation && currentConversation.id === conversationId) {
          leaveConversation();
        }
      }
      
      return data.success;
    } catch (error) {
      console.error('Erreur fermeture conversation:', error);
      setError(error.message);
      return false;
    }
  }, [loadConversations, currentConversation, leaveConversation]);

  // Rouvrir une conversation (professionnels uniquement)
  const reopenConversation = useCallback(async (conversationId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/chat/conversations/${conversationId}/reopen`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Erreur lors de la réouverture');

      const data = await response.json();
      if (data.success) {
        await loadConversations();
      }
      
      return data.success;
    } catch (error) {
      console.error('Erreur réouverture conversation:', error);
      setError(error.message);
      return false;
    }
  }, [loadConversations]);

  // Charger les statistiques (professionnels uniquement)
  const loadChatStats = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5000/api/chat/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Erreur lors du chargement des statistiques');

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Erreur chargement stats chat:', error);
      setError(error.message);
      return null;
    }
  }, []);

  // Effacer les erreurs
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Initialisation et nettoyage
  useEffect(() => {
    if (user && userType) {
      initializeSocket();
      loadConversations();
    }

    return () => {
      closeSocket();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [user, userType, initializeSocket, loadConversations, closeSocket]);

  // Auto-reconnexion
  useEffect(() => {
    if (!isConnected && user && userType && reconnectAttemptsRef.current < 5) {
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('🔄 Tentative de reconnexion chat...');
        initializeSocket();
      }, 5000);
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [isConnected, user, userType, initializeSocket]);

  // Marquer automatiquement les messages comme lus quand on rejoint une conversation
  useEffect(() => {
    if (currentConversation && isConnected) {
      const timer = setTimeout(() => {
        markMessagesAsRead(currentConversation.id);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [currentConversation, isConnected, markMessagesAsRead]);

  return {
    // État
    isConnected,
    conversations,
    currentConversation,
    messages,
    participants,
    typingUsers,
    loading,
    error,
    unreadCount,

    // Actions
    loadConversations,
    createConversation,
    joinConversation,
    leaveConversation,
    loadMessages,
    sendMessage,
    markMessagesAsRead,
    handleTyping,
    startTyping,
    stopTyping,
    closeConversation,
    reopenConversation,
    loadChatStats,
    clearError,
    closeSocket,

    // Utilitaires
    isTyping: typingUsers.length > 0,
    canSendMessage: isConnected && currentConversation,
    canCloseConversation: userType === 'user' && currentConversation?.statut === 'active',
    canReopenConversation: userType === 'user' && currentConversation?.statut === 'fermee'
  };
};

export default useChat;