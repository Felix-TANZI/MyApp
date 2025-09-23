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

  // CORRECTION: Fonction pour obtenir le token et les headers d'auth
  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('accessToken');
    
    console.log('🔍 Récupération token pour API:', { 
      hasToken: !!token, 
      tokenLength: token ? token.length : 0 
    });
    
    if (!token) {
      throw new Error('Token d\'accès non trouvé');
    }
    
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }, []);

  // CORRECTION: Déterminer le type d'utilisateur correct
  const determineUserType = useCallback(() => {
    if (!user) return null;
    
    // Si userType est explicitement passé, l'utiliser
    if (userType === 'user' || userType === 'client') {
      return userType;
    }
    
    // Sinon, déduire du profil utilisateur
    if (user.role && ['admin', 'commercial', 'comptable'].includes(user.role)) {
      return 'user';
    }
    
    if (user.code_client || user.userType === 'client') {
      return 'client';
    }
    
    // Fallback basé sur les propriétés disponibles
    return user.userType || 'client';
  }, [user, userType]);

  // Initialisation du socket - VERSION CORRIGÉE
  const initializeSocket = useCallback(() => {
    const actualUserType = determineUserType();
    
    if (!user || !actualUserType) {
      console.log('⚠️ Pas d\'utilisateur pour WebSocket');
      return;
    }

    // Vérifier la disponibilité du token avant de se connecter
    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.log('⚠️ Token non disponible pour WebSocket, report de la connexion');
      // Retry après 1 seconde
      setTimeout(() => {
        initializeSocket();
      }, 1000);
      return;
    }

    if (socketRef.current?.connected) {
      console.log('🔌 Socket déjà connecté');
      return;
    }

    console.log('🔌 Initialisation du socket chat...', { 
      userId: user.id, 
      userType: actualUserType,
      hasToken: true,
      tokenLength: token.length
    });

    try {
      // Se connecter au namespace principal
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
  console.log('🔍 Socket connecté - détails:', {
    id: socket.id,
    connected: socket.connected,
    disconnected: socket.disconnected
  });
  
  setIsConnected(true);
  setError(null);
  reconnectAttemptsRef.current = 0;

  // Authentification avec vérification du token
  const currentToken = localStorage.getItem('accessToken');
  console.log('🔍 Récupération token pour WebSocket:', { 
    hasToken: !!currentToken, 
    tokenLength: currentToken ? currentToken.length : 0 
  });
  
  if (currentToken) {
    console.log('🔐 Authentification chat:', { 
      userType: actualUserType, 
      hasToken: true,
      tokenStart: currentToken.substring(0, 20) + '...',
      socketId: socket.id
    });
    
    console.log('🚀 ÉMISSION chat_authenticate...');
    socket.emit('chat_authenticate', { 
      token: currentToken, 
      userType: actualUserType 
    });
    console.log('✅ Événement chat_authenticate émis');
    
  } else {
    console.error('❌ Token manquant au moment de l\'authentification');
    setError('Token d\'authentification manquant');
    socket.disconnect();
  }
});

socket.on('disconnect', (reason) => {
  console.log('❌ Chat déconnecté:', reason);
  console.log('🔍 Détails déconnexion:', {
    reason,
    connected: socket.connected,
    disconnected: socket.disconnected
  });
  setIsConnected(false);
  setParticipants([]);
  setTypingUsers([]);
});

socket.on('connect_error', (error) => {
  console.error('🔌 Erreur connexion chat:', error);
  console.log('🔍 Détails erreur connexion:', {
    message: error.message,
    description: error.description,
    context: error.context,
    type: error.type
  });
  setError('Erreur de connexion au chat');
  setIsConnected(false);
  
  reconnectAttemptsRef.current++;
  if (reconnectAttemptsRef.current >= 5) {
    setError('Impossible de se connecter au chat. Vérifiez votre connexion.');
  }
});

// Événements d'authentification avec debug
socket.on('chat_authenticated', (data) => {
  console.log('🔐 Chat authentifié:', data);
  console.log('✅ AUTHENTIFICATION RÉUSSIE - données reçues:', data);
  setError(null);
});

socket.on('chat_auth_error', (error) => {
  console.error('❌ Erreur auth chat:', error);
  console.log('💥 ÉCHEC AUTHENTIFICATION - détails:', error);
  setError(`Erreur d'authentification: ${error.message || 'Token invalide'}`);
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
        console.error('❌ Erreur chat:', error);
        setError(error.message);
      });

      // Connecter le socket
      socket.connect();

    } catch (error) {
      console.error('❌ Erreur initialisation socket:', error);
      setError('Erreur lors de l\'initialisation du chat');
    }

  }, [user, determineUserType, currentConversation]);

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

  // CORRECTION: Charger les conversations avec gestion d'erreur améliorée
  const loadConversations = useCallback(async (page = 1, search = '', status = '') => {
    const actualUserType = determineUserType();
    
    if (!user || !actualUserType) {
      console.log('⚠️ Impossible de charger les conversations: utilisateur non défini');
      return null;
    }

    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        search,
        statut: status
      });

      const headers = getAuthHeaders();
      
      console.log('📡 Chargement conversations:', `GET /api/chat/conversations?${params}`);

      const response = await fetch(`http://localhost:5000/api/chat/conversations?${params}`, {
        headers
      });

      console.log('📡 Réponse conversations:', response.status, response.statusText);

      if (!response.ok) {
        let errorMessage = `Erreur HTTP ${response.status}`;
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
          console.error('📡 Erreur API conversations:', errorData);
        } catch (parseError) {
          console.error('❌ Erreur parsing réponse:', parseError);
          if (response.status === 404) {
            errorMessage = 'Route non trouvée - Le service de chat n\'est peut-être pas disponible';
          } else if (response.status === 401) {
            errorMessage = 'Session expirée - Veuillez vous reconnecter';
          } else if (response.status === 500) {
            errorMessage = 'Erreur serveur - Le service de chat est temporairement indisponible';
          }
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('✅ Conversations chargées:', data.data?.conversations?.length || 0);
      
      if (data.success && data.data?.conversations) {
        if (page === 1) {
          setConversations(data.data.conversations);
        } else {
          setConversations(prev => [...prev, ...data.data.conversations]);
        }

        // Calculer les messages non lus
        const totalUnread = data.data.conversations.reduce((total, conv) => {
          const unreadField = actualUserType === 'client' 
            ? 'messages_non_lus_client' 
            : 'messages_non_lus_professionnels';
          return total + (conv[unreadField] || 0);
        }, 0);
        setUnreadCount(totalUnread);

        return data.data;
      } else {
        throw new Error('Format de réponse invalide');
      }

    } catch (error) {
      console.error('❌ Erreur chargement conversations:', error);
      setError(error.message);
      
      // Si erreur d'authentification, nettoyer les données
      if (error.message.includes('Session expirée') || error.message.includes('Token')) {
        setConversations([]);
        setUnreadCount(0);
      }
      
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, determineUserType, getAuthHeaders]);

  // CORRECTION: Créer une nouvelle conversation avec gestion d'erreur améliorée
  const createConversation = useCallback(async (sujet = 'Support général') => {
    const actualUserType = determineUserType();
    
    if (!user || actualUserType !== 'client') {
      setError('Seuls les clients peuvent créer des conversations');
      return null;
    }

    try {
      setLoading(true);
      setError(null);
      
      const headers = getAuthHeaders();
      
      console.log('📡 Création conversation:', 'POST /api/chat/conversations');

      const response = await fetch('http://localhost:5000/api/chat/conversations', {
        method: 'POST',
        headers,
        body: JSON.stringify({ sujet })
      });

      console.log('📡 Réponse création conversation:', response.status, response.statusText);

      if (!response.ok) {
        let errorMessage = `Erreur HTTP ${response.status}`;
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
          console.error('📡 Erreur API création conversation:', errorData);
        } catch (parseError) {
          if (response.status === 404) {
            errorMessage = 'Service de chat non disponible';
          } else if (response.status === 401) {
            errorMessage = 'Session expirée - Veuillez vous reconnecter';
          } else if (response.status === 403) {
            errorMessage = 'Permission refusée';
          }
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('✅ Conversation créée:', data);
      
      if (data.success) {
        // Recharger les conversations
        await loadConversations();
        return data.data;
      }
      throw new Error(data.message || 'Erreur lors de la création');
    } catch (error) {
      console.error('❌ Erreur création conversation:', error);
      setError(error.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, determineUserType, loadConversations, getAuthHeaders]);

  // Rejoindre une conversation
  const joinConversation = useCallback(async (conversationId) => {
    try {
      setLoading(true);
      
      const headers = getAuthHeaders();
      
      console.log('🔗 Rejoint conversation:', conversationId);

      // Charger les détails de la conversation
      const response = await fetch(`http://localhost:5000/api/chat/conversations/${conversationId}`, {
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Conversation introuvable');
      }

      const convData = await response.json();
      
      if (convData.success) {
        setCurrentConversation(convData.data);

        // Charger les messages
        await loadMessages(conversationId);

        // Rejoindre via WebSocket
        if (socketRef.current?.connected) {
          socketRef.current.emit('join_conversation', { conversationId });
        }

        return convData.data;
      }
      
      throw new Error(convData.message || 'Erreur lors du chargement de la conversation');
    } catch (error) {
      console.error('❌ Erreur rejoindre conversation:', error);
      setError(error.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  // Quitter une conversation
  const leaveConversation = useCallback(() => {
    if (currentConversation && socketRef.current?.connected) {
      console.log('👋 Quitter conversation:', currentConversation.id);
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
      const headers = getAuthHeaders();
      
      const response = await fetch(`http://localhost:5000/api/chat/conversations/${conversationId}/messages?page=${page}&limit=50`, {
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Erreur lors du chargement des messages');
      }

      const data = await response.json();
      
      if (data.success) {
        if (page === 1) {
          setMessages(data.data.messages);
        } else {
          setMessages(prev => [...data.data.messages, ...prev]);
        }
        return data.data;
      }
      
      throw new Error(data.message || 'Erreur lors du chargement des messages');
    } catch (error) {
      console.error('❌ Erreur chargement messages:', error);
      setError(error.message);
      return null;
    }
  }, [getAuthHeaders]);

  // Envoyer un message
  const sendMessage = useCallback((message, type = 'text') => {
    if (!currentConversation || !socketRef.current?.connected || !message.trim()) {
      console.log('⚠️ Impossible d\'envoyer le message:', { 
        hasConversation: !!currentConversation, 
        isConnected: socketRef.current?.connected,
        hasMessage: !!message.trim()
      });
      return false;
    }

    console.log('💬 Envoi message:', { conversationId: currentConversation.id, message: message.substring(0, 50) + '...' });

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
      console.log('✅ Marquer messages lus:', conversationId);
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
    const actualUserType = determineUserType();
    
    if (actualUserType !== 'user') {
      setError('Seuls les professionnels peuvent fermer les conversations');
      return false;
    }

    try {
      const headers = getAuthHeaders();
      
      const response = await fetch(`http://localhost:5000/api/chat/conversations/${conversationId}/close`, {
        method: 'POST',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Erreur lors de la fermeture');
      }

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
      console.error('❌ Erreur fermeture conversation:', error);
      setError(error.message);
      return false;
    }
  }, [determineUserType, loadConversations, currentConversation, leaveConversation, getAuthHeaders]);

  // Rouvrir une conversation (professionnels uniquement)
  const reopenConversation = useCallback(async (conversationId) => {
    const actualUserType = determineUserType();
    
    if (actualUserType !== 'user') {
      setError('Seuls les professionnels peuvent rouvrir les conversations');
      return false;
    }

    try {
      const headers = getAuthHeaders();
      
      const response = await fetch(`http://localhost:5000/api/chat/conversations/${conversationId}/reopen`, {
        method: 'POST',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Erreur lors de la réouverture');
      }

      const data = await response.json();
      if (data.success) {
        await loadConversations();
      }
      
      return data.success;
    } catch (error) {
      console.error('❌ Erreur réouverture conversation:', error);
      setError(error.message);
      return false;
    }
  }, [determineUserType, loadConversations, getAuthHeaders]);

  // Charger les statistiques (professionnels uniquement)
  const loadChatStats = useCallback(async () => {
    const actualUserType = determineUserType();
    
    if (actualUserType !== 'user') {
      return null;
    }

    try {
      const headers = getAuthHeaders();
      
      const response = await fetch('http://localhost:5000/api/chat/stats', {
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Erreur lors du chargement des statistiques');
      }

      const data = await response.json();
      return data.success ? data.data : null;
    } catch (error) {
      console.error('❌ Erreur chargement stats chat:', error);
      setError(error.message);
      return null;
    }
  }, [determineUserType, getAuthHeaders]);

  // Effacer les erreurs
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // MODIFICATION CRITIQUE: Retarder l'initialisation jusqu'à ce que le token soit disponible
  useEffect(() => {
    if (user && determineUserType()) {
      console.log('🚀 Initialisation chat pour:', { userId: user.id, userType: determineUserType() });
      
      // Vérifier si le token est déjà disponible
      const token = localStorage.getItem('accessToken');
      if (token) {
        // Token disponible, initialiser immédiatement
        initializeSocket();
        loadConversations();
      } else {
        // Token pas encore disponible, attendre un peu
        console.log('⏳ En attente du token...');
        setTimeout(() => {
          if (localStorage.getItem('accessToken')) {
            console.log('🔄 Token disponible, initialisation différée');
            initializeSocket();
            loadConversations();
          } else {
            console.log('❌ Token toujours indisponible après délai');
            setError('Token d\'authentification indisponible');
          }
        }, 1000);
      }
    }

    return () => {
      closeSocket();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [user, initializeSocket, loadConversations, closeSocket, determineUserType]);

  // Auto-reconnexion
  useEffect(() => {
    if (!isConnected && user && determineUserType() && reconnectAttemptsRef.current < 5) {
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
  }, [isConnected, user, determineUserType, initializeSocket]);

  // Marquer automatiquement les messages comme lus quand on rejoint une conversation
  useEffect(() => {
    if (currentConversation && isConnected) {
      const timer = setTimeout(() => {
        markMessagesAsRead(currentConversation.id);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [currentConversation, isConnected, markMessagesAsRead]);

  const actualUserType = determineUserType();

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
    canSendMessage: isConnected && currentConversation && currentConversation.statut === 'active',
    canCloseConversation: actualUserType === 'user' && currentConversation?.statut === 'active',
    canReopenConversation: actualUserType === 'user' && currentConversation?.statut === 'fermee'
  };
};

export default useChat;