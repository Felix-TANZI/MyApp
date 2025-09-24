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
  
  // États spécifiques à l'Assistant Amani
  const [isAssistantActive, setIsAssistantActive] = useState(false);
  const [assistantStats, setAssistantStats] = useState(null);

  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isInitializedRef = useRef(false);
  const currentUserRef = useRef(null);
  const currentUserTypeRef = useRef(null);

  // Mise à jour des refs sans déclencher de re-render
  useEffect(() => {
    currentUserRef.current = user;
    currentUserTypeRef.current = userType;
  }, [user, userType]);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      throw new Error('Token d\'accès non trouvé');
    }
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }, []);

  const determineUserType = useCallback(() => {
    const user = currentUserRef.current;
    const userType = currentUserTypeRef.current;
    
    if (!user) return null;
    
    if (userType === 'user' || userType === 'client') {
      return userType;
    }
    
    if (user.role && ['admin', 'commercial', 'comptable'].includes(user.role)) {
      return 'user';
    }
    
    if (user.code_client || user.userType === 'client') {
      return 'client';
    }
    
    return user.userType || 'client';
  }, []);

  // Vérifier le statut de l'assistant
  const checkAssistantStatus = useCallback(async () => {
    const actualUserType = determineUserType();
    
    if (actualUserType !== 'client') {
      return null;
    }

    try {
      const headers = getAuthHeaders();
      const response = await fetch('http://localhost:5000/api/assistant/status', {
        headers
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la vérification du statut assistant');
      }

      const data = await response.json();
      
      if (data.success) {
        setIsAssistantActive(data.data.active && data.data.enabled);
        return data.data;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Erreur vérification statut assistant:', error);
      setIsAssistantActive(false);
      return null;
    }
  }, [determineUserType, getAuthHeaders]);

  // Charger les stats de l'assistant (professionnels)
  const loadAssistantStats = useCallback(async () => {
    const actualUserType = determineUserType();
    
    if (actualUserType !== 'user') {
      return null;
    }

    try {
      const headers = getAuthHeaders();
      const response = await fetch('http://localhost:5000/api/assistant/stats', {
        headers
      });

      if (!response.ok) {
        throw new Error('Erreur lors du chargement des statistiques assistant');
      }

      const data = await response.json();
      
      if (data.success) {
        setAssistantStats(data.data);
        return data.data;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Erreur chargement stats assistant:', error);
      return null;
    }
  }, [determineUserType, getAuthHeaders]);

  // Fonctions stables pour les événements Socket.IO
  const handleNewMessage = useCallback((messageData) => {
    console.log('💬 Nouveau message reçu:', messageData);
    
    setMessages(prevMessages => {
      const messageExists = prevMessages.some(msg => msg.id === messageData.id);
      if (messageExists) {
        return prevMessages;
      }
      return [...prevMessages, messageData];
    });
    
    setConversations(prevConversations => 
      prevConversations.map(conv => 
        conv.id === messageData.conversation_id 
          ? {
              ...conv,
              dernier_message: messageData.message,
              date_dernier_message: messageData.date_creation,
              derniere_activite: messageData.date_creation
            }
          : conv
      )
    );

    // Si c'est un message de l'assistant, revérifier le statut après un délai
    if (messageData.sender_type === 'assistant') {
      console.log('🤖 Message assistant reçu, revérifier statut dans 5s');
      setTimeout(() => {
        checkAssistantStatus();
      }, 5000);
    }
  }, [checkAssistantStatus]);

  const handleUserJoined = useCallback((data) => {
    console.log('👤 Utilisateur rejoint:', data);
    setParticipants(prev => {
      const exists = prev.find(p => p.user_id === data.userId && p.user_type === data.userType);
      if (exists) {
        return prev.map(p => 
          p.user_id === data.userId && p.user_type === data.userType
            ? { ...p, en_ligne: true }
            : p
        );
      }
      return [...prev, {
        user_id: data.userId,
        user_type: data.userType,
        nom: data.userInfo.nom,
        prenom: data.userInfo.prenom,
        role: data.userInfo.role || 'Client',
        en_ligne: true
      }];
    });
  }, []);

  const handleUserLeft = useCallback((data) => {
    console.log('👋 Utilisateur parti:', data);
    setParticipants(prev => 
      prev.map(p => 
        p.user_id === data.userId && p.user_type === data.userType 
          ? { ...p, en_ligne: false }
          : p
      )
    );
  }, []);

  const handleUserTyping = useCallback((data) => {
    if (data.isTyping) {
      setTypingUsers(prev => {
        const exists = prev.find(u => u.userId === data.userId && u.userType === data.userType);
        if (exists) return prev;
        return [...prev, data];
      });
      
      setTimeout(() => {
        setTypingUsers(prev => 
          prev.filter(u => !(u.userId === data.userId && u.userType === data.userType))
        );
      }, 5000);
    } else {
      setTypingUsers(prev => 
        prev.filter(u => !(u.userId === data.userId && u.userType === data.userType))
      );
    }
  }, []);

  // Initialisation socket
  const initializeSocket = useCallback(() => {
    if (socketRef.current?.connected || !currentUserRef.current) {
      console.log('🔌 Socket déjà connecté ou pas d\'utilisateur');
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.log('⚠️ Token non disponible, retry dans 2s');
      setTimeout(initializeSocket, 2000);
      return;
    }

    const actualUserType = determineUserType();
    if (!actualUserType) {
      console.log('⚠️ Type utilisateur non déterminable');
      return;
    }

    console.log('🔌 Initialisation socket chat:', { 
      userId: currentUserRef.current.id, 
      userType: actualUserType 
    });

    // Fermer l'ancien socket s'il existe
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    try {
      socketRef.current = io(`${SOCKET_URL}/chat`, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        forceNew: true,
        reconnection: false,
        timeout: 20000
      });

      const socket = socketRef.current;

      // Configuration des listeners
      socket.on('connect', () => {
        console.log('✅ Chat connecté:', socket.id);
        setIsConnected(true);
        setError(null);

        // Vérifier le statut de l'assistant après connexion (clients uniquement)
        if (actualUserType === 'client') {
          checkAssistantStatus();
        }

        // Authentification immédiate
        const currentToken = localStorage.getItem('accessToken');
        const userTypeToUse = determineUserType();
        
        if (currentToken && userTypeToUse) {
          console.log('🔐 Authentification chat automatique');
          socket.emit('chat_authenticate', { 
            token: currentToken, 
            userType: userTypeToUse 
          });
        }
      });

      socket.on('disconnect', (reason) => {
        console.log('❌ Chat déconnecté:', reason);
        setIsConnected(false);
        setParticipants([]);
        setTypingUsers([]);
        setIsAssistantActive(false);
      });

      socket.on('connect_error', (error) => {
        console.error('🔌 Erreur connexion chat:', error);
        setError('Erreur de connexion au chat');
        setIsConnected(false);
      });

      socket.on('chat_authenticated', (data) => {
        console.log('🔐 Chat authentifié:', data);
        setError(null);
      });

      socket.on('chat_auth_error', (error) => {
        console.error('❌ Erreur auth chat:', error);
        setError(`Erreur d'authentification: ${error.message || 'Token invalide'}`);
        setIsConnected(false);
      });

      socket.on('conversation_joined', (data) => {
        console.log('🏠 Conversation rejointe:', data);
        setParticipants(data.onlineParticipants || []);
      });

      // Utiliser les fonctions stables
      socket.on('user_joined', handleUserJoined);
      socket.on('user_left', handleUserLeft);
      socket.on('new_message', handleNewMessage);
      socket.on('user_typing', handleUserTyping);

      // Événements spécifiques à l'assistant
      socket.on('assistant_message', (messageData) => {
        console.log('🤖 Message assistant reçu:', messageData);
        handleNewMessage(messageData);
      });

      socket.on('assistant_status_changed', (data) => {
        console.log('🤖 Statut assistant changé:', data);
        setIsAssistantActive(data.active && data.enabled);
      });

      socket.on('messages_read', (data) => {
        console.log('✅ Messages lus:', data);
      });

      socket.on('error', (error) => {
        console.error('❌ Erreur chat:', error);
        setError(error.message);
      });

      socket.on('session_replaced', (data) => {
        console.log('🔄 Session remplacée:', data.message);
      });

    } catch (error) {
      console.error('❌ Erreur initialisation socket:', error);
      setError('Erreur lors de l\'initialisation du chat');
    }

  }, [determineUserType, handleUserJoined, handleUserLeft, handleNewMessage, handleUserTyping, checkAssistantStatus]);

  // Fermeture propre du socket
  const closeSocket = useCallback(() => {
    if (socketRef.current) {
      console.log('🔌 Fermeture du socket chat');
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    setIsConnected(false);
    setParticipants([]);
    setTypingUsers([]);
    setIsAssistantActive(false);
  }, []);

  const loadConversations = useCallback(async (page = 1, search = '', status = '') => {
    const actualUserType = determineUserType();
    
    if (!currentUserRef.current || !actualUserType) {
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
      const response = await fetch(`http://localhost:5000/api/chat/conversations?${params}`, {
        headers
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.data?.conversations) {
        if (page === 1) {
          setConversations(data.data.conversations);
        } else {
          setConversations(prev => [...prev, ...data.data.conversations]);
        }

        const totalUnread = data.data.conversations.reduce((total, conv) => {
          const unreadField = actualUserType === 'client' 
            ? 'messages_non_lus_client' 
            : 'messages_non_lus_professionnels';
          return total + (conv[unreadField] || 0);
        }, 0);
        setUnreadCount(totalUnread);

        return data.data;
      }
      
      throw new Error('Format de réponse invalide');
    } catch (error) {
      console.error('❌ Erreur chargement conversations:', error);
      setError(error.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [determineUserType, getAuthHeaders]);

  const createConversation = useCallback(async (sujet = 'Support général') => {
    const actualUserType = determineUserType();
    
    if (!currentUserRef.current || actualUserType !== 'client') {
      setError('Seuls les clients peuvent créer des conversations');
      return null;
    }

    try {
      setLoading(true);
      setError(null);
      
      const headers = getAuthHeaders();
      const response = await fetch('http://localhost:5000/api/chat/conversations', {
        method: 'POST',
        headers,
        body: JSON.stringify({ sujet })
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
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
  }, [determineUserType, loadConversations, getAuthHeaders]);

  const joinConversation = useCallback(async (conversationId) => {
    try {
      setLoading(true);
      
      const headers = getAuthHeaders();
      const response = await fetch(`http://localhost:5000/api/chat/conversations/${conversationId}`, {
        headers
      });

      if (!response.ok) {
        throw new Error('Conversation introuvable');
      }

      const convData = await response.json();
      
      if (convData.success) {
        setCurrentConversation(convData.data);
        await loadMessages(conversationId);

        // Rejoindre via WebSocket
        if (socketRef.current?.connected) {
          console.log('🔗 Émission join_conversation pour:', conversationId);
          socketRef.current.emit('join_conversation', { conversationId });
        }

        return convData.data;
      }
      
      throw new Error(convData.message);
    } catch (error) {
      console.error('❌ Erreur rejoindre conversation:', error);
      setError(error.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  const leaveConversation = useCallback(() => {
    if (currentConversation && socketRef.current?.connected) {
      console.log('👋 Émission leave_conversation pour:', currentConversation.id);
      socketRef.current.emit('leave_conversation', { 
        conversationId: currentConversation.id 
      });
    }
    
    setCurrentConversation(null);
    setMessages([]);
    setParticipants([]);
    setTypingUsers([]);
  }, [currentConversation]);

  const loadMessages = useCallback(async (conversationId, page = 1) => {
    try {
      const headers = getAuthHeaders();
      const response = await fetch(`http://localhost:5000/api/chat/conversations/${conversationId}/messages?page=${page}&limit=50`, {
        headers
      });

      if (!response.ok) {
        throw new Error('Erreur lors du chargement des messages');
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
      
      throw new Error(data.message);
    } catch (error) {
      console.error('❌ Erreur chargement messages:', error);
      setError(error.message);
      return null;
    }
  }, [getAuthHeaders]);

  const sendMessage = useCallback((message, type = 'text') => {
    if (!currentConversation || !socketRef.current?.connected || !message.trim()) {
      console.log('⚠️ Impossible d\'envoyer le message');
      return false;
    }

    console.log('💬 Émission send_message:', { 
      conversationId: currentConversation.id, 
      message: message.substring(0, 50) + '...' 
    });

    socketRef.current.emit('send_message', {
      conversationId: currentConversation.id,
      message: message.trim(),
      type
    });

    return true;
  }, [currentConversation]);

  const markMessagesAsRead = useCallback((conversationId) => {
    if (socketRef.current?.connected) {
      console.log('✅ Émission mark_messages_read pour:', conversationId);
      socketRef.current.emit('mark_messages_read', { conversationId });
    }
  }, []);

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

  const handleTyping = useCallback(() => {
    startTyping();
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, [startTyping, stopTyping]);

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
        throw new Error('Erreur lors de la fermeture');
      }

      const data = await response.json();
      if (data.success) {
        await loadConversations();
        
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
        throw new Error('Erreur lors de la réouverture');
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
        throw new Error('Erreur lors du chargement des statistiques');
      }

      const data = await response.json();
      return data.success ? data.data : null;
    } catch (error) {
      console.error('❌ Erreur chargement stats chat:', error);
      return null;
    }
  }, [determineUserType, getAuthHeaders]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Effet d'initialisation unique
  useEffect(() => {
    if (isInitializedRef.current || !user) return;
    
    const actualUserType = determineUserType();
    if (!actualUserType) return;

    console.log('🚀 Initialisation chat unique:', { userId: user.id, userType: actualUserType });
    isInitializedRef.current = true;
    
    const initTimer = setTimeout(() => {
      initializeSocket();
      loadConversations();
    }, 1000);

    return () => {
      console.log('🧹 Nettoyage du hook chat');
      clearTimeout(initTimer);
      closeSocket();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      isInitializedRef.current = false;
    };
  }, [user?.id, initializeSocket, loadConversations, closeSocket, determineUserType]);

  // Auto-marquage des messages comme lus
  useEffect(() => {
    if (currentConversation && isConnected) {
      const timer = setTimeout(() => {
        markMessagesAsRead(currentConversation.id);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [currentConversation, isConnected, markMessagesAsRead]);

  // Vérification périodique du statut de l'assistant (clients uniquement)
  useEffect(() => {
    if (!user || determineUserType() !== 'client') return;

    const interval = setInterval(() => {
      checkAssistantStatus();
    }, 30000); // Vérifier toutes les 30 secondes

    return () => clearInterval(interval);
  }, [user, checkAssistantStatus, determineUserType]);

  const actualUserType = determineUserType();

  return {
    // État général
    isConnected,
    conversations,
    currentConversation,
    messages,
    participants,
    typingUsers,
    loading,
    error,
    unreadCount,

    // États Assistant Amani
    isAssistantActive,
    assistantStats,

    // Actions principales
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

    // Actions Assistant
    checkAssistantStatus,
    loadAssistantStats,

    // Utilitaires
    isTyping: typingUsers.length > 0,
    canSendMessage: isConnected && currentConversation && currentConversation.statut === 'active',
    canCloseConversation: actualUserType === 'user' && currentConversation?.statut === 'active',
    canReopenConversation: actualUserType === 'user' && currentConversation?.statut === 'fermee'
  };
};

export default useChat;