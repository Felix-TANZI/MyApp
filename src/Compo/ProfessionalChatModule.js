import React, { useState, useEffect, useRef } from 'react';
import AuthContext from "../contexts/AuthContext";
import useChat from "../hooks/useChat";
import './ProfessionalChatModule.css';

const ProfessionalChatModule = ({ user, onBack }) => {
  const chat = useChat(user, 'user');
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messageInput, setMessageInput] = useState('');
  const [conversationsFilter, setConversationsFilter] = useState('all'); // all, active, closed
  const [searchQuery, setSearchQuery] = useState('');
  const [showStats, setShowStats] = useState(false);
  const [chatStats, setChatStats] = useState(null);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll vers le bas quand de nouveaux messages arrivent
  useEffect(() => {
    scrollToBottom();
  }, [chat.messages]);

  // Auto-focus sur l'input quand une conversation est sélectionnée
  useEffect(() => {
    if (selectedConversation && inputRef.current) {
      inputRef.current.focus();
    }
  }, [selectedConversation]);

  // Charger les statistiques du chat
  useEffect(() => {
    loadChatStats();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChatStats = async () => {
    const stats = await chat.loadChatStats();
    if (stats) {
      setChatStats(stats);
    }
  };

  const handleSelectConversation = async (conversation) => {
    if (selectedConversation?.id === conversation.id) return;
    
    // Quitter la conversation précédente
    if (selectedConversation) {
      chat.leaveConversation();
    }
    
    setSelectedConversation(conversation);
    await chat.joinConversation(conversation.id);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    
    if (!messageInput.trim() || !chat.canSendMessage) return;

    const success = chat.sendMessage(messageInput);
    if (success) {
      setMessageInput('');
      chat.stopTyping();
    }
  };

  const handleInputChange = (e) => {
    setMessageInput(e.target.value);
    if (e.target.value.trim()) {
      chat.handleTyping();
    } else {
      chat.stopTyping();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const handleCloseConversation = async (conversationId) => {
    if (window.confirm('Êtes-vous sûr de vouloir fermer cette conversation ?')) {
      const success = await chat.closeConversation(conversationId);
      if (success && selectedConversation?.id === conversationId) {
        setSelectedConversation(null);
      }
    }
  };

  const handleReopenConversation = async (conversationId) => {
    const success = await chat.reopenConversation(conversationId);
    if (success) {
      // Recharger les conversations
      chat.loadConversations(1, searchQuery, conversationsFilter);
    }
  };

  const handleFilterChange = (filter) => {
    setConversationsFilter(filter);
    chat.loadConversations(1, searchQuery, filter);
  };

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    // Debounce la recherche
    clearTimeout(handleSearchChange.timeoutId);
    handleSearchChange.timeoutId = setTimeout(() => {
      chat.loadConversations(1, query, conversationsFilter);
    }, 500);
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'À l\'instant';
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffHours < 48) return 'Hier';
    return date.toLocaleDateString('fr-FR');
  };

  const getMessageSenderDisplay = (message) => {
    if (message.sender_type === 'user') {
      return `${message.sender_prenom} ${message.sender_nom}`;
    }
    return `${message.sender_prenom} ${message.sender_nom} (Client)`;
  };

  const getStatusColor = (statut) => {
    switch (statut) {
      case 'active': return 'green';
      case 'fermee': return 'gray';
      case 'en_attente': return 'orange';
      default: return 'blue';
    }
  };

  const getStatusLabel = (statut) => {
    switch (statut) {
      case 'active': return 'Active';
      case 'fermee': return 'Fermée';
      case 'en_attente': return 'En attente';
      default: return 'Inconnue';
    }
  };

  const filteredConversations = chat.conversations.filter(conv => {
    const matchesFilter = conversationsFilter === 'all' || conv.statut === conversationsFilter;
    const matchesSearch = !searchQuery || 
      conv.client_nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.client_prenom.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.client_entreprise?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.sujet.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="professional-chat-module">
      {/* Header */}
      <div className="module-header">
        <div className="header-left">
          <button className="back-btn" onClick={onBack}>
            ← Retour
          </button>
          <div className="module-title">
            <h1>Chat Support Client</h1>
            <div className="connection-status">
              {chat.isConnected ? (
                <span className="status-connected">
                  <span className="status-dot"></span>
                  Connecté ({chat.conversations.length} conversations)
                </span>
              ) : (
                <span className="status-disconnected">
                  <span className="status-dot"></span>
                  Déconnecté
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="header-right">
          <button 
            className={`stats-btn ${showStats ? 'active' : ''}`}
            onClick={() => setShowStats(!showStats)}
          >
            📊 Statistiques
          </button>
        </div>
      </div>

      {/* Affichage des erreurs */}
      {chat.error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <span>{chat.error}</span>
          <button onClick={chat.clearError} className="error-close">×</button>
        </div>
      )}

      {/* Statistiques */}
      {showStats && chatStats && (
        <div className="stats-panel">
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-value">{chatStats.totalConnected}</span>
              <span className="stat-label">Connectés</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{chatStats.connectedClients}</span>
              <span className="stat-label">Clients en ligne</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{chatStats.connectedProfessionals}</span>
              <span className="stat-label">Équipe en ligne</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{chatStats.activeConversations}</span>
              <span className="stat-label">Conversations actives</span>
            </div>
          </div>
        </div>
      )}

      {/* Corps principal */}
      <div className="chat-body">
        {/* Panel des conversations */}
        <div className="conversations-panel">
          <div className="conversations-header">
            <h2>Conversations</h2>
            
            {/* Filtres */}
            <div className="filters-section">
              <div className="filter-buttons">
                <button 
                  className={`filter-btn ${conversationsFilter === 'all' ? 'active' : ''}`}
                  onClick={() => handleFilterChange('all')}
                >
                  Toutes ({chat.conversations.length})
                </button>
                <button 
                  className={`filter-btn ${conversationsFilter === 'active' ? 'active' : ''}`}
                  onClick={() => handleFilterChange('active')}
                >
                  Actives ({chat.conversations.filter(c => c.statut === 'active').length})
                </button>
                <button 
                  className={`filter-btn ${conversationsFilter === 'fermee' ? 'active' : ''}`}
                  onClick={() => handleFilterChange('fermee')}
                >
                  Fermées ({chat.conversations.filter(c => c.statut === 'fermee').length})
                </button>
              </div>
              
              {/* Recherche */}
              <div className="search-section">
                <input
                  type="text"
                  placeholder="Rechercher par nom, entreprise..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="search-input"
                />
              </div>
            </div>
          </div>
          
          {/* Liste des conversations */}
          <div className="conversations-list">
            {chat.loading && chat.conversations.length === 0 ? (
              <div className="loading-conversations">
                <div className="loading-spinner"></div>
                <p>Chargement des conversations...</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="no-conversations">
                <div className="empty-icon">💬</div>
                <h3>Aucune conversation</h3>
                <p>Les conversations client apparaîtront ici.</p>
              </div>
            ) : (
              filteredConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`conversation-item ${
                    selectedConversation?.id === conversation.id ? 'selected' : ''
                  } ${conversation.messages_non_lus_professionnels > 0 ? 'has-unread' : ''}`}
                  onClick={() => handleSelectConversation(conversation)}
                >
                  <div className="conversation-avatar">
                    {conversation.client_nom.charAt(0)}{conversation.client_prenom?.charAt(0)}
                  </div>
                  
                  <div className="conversation-content">
                    <div className="conversation-header">
                      <div className="client-info">
                        <span className="client-name">
                          {conversation.client_prenom} {conversation.client_nom}
                        </span>
                        {conversation.client_entreprise && (
                          <span className="client-company">
                            {conversation.client_entreprise}
                          </span>
                        )}
                      </div>
                      
                      <div className="conversation-meta">
                        <span className={`status-badge ${getStatusColor(conversation.statut)}`}>
                          {getStatusLabel(conversation.statut)}
                        </span>
                        <span className="conversation-time">
                          {formatTime(conversation.derniere_activite)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="conversation-preview">
                      <span className="last-message">
                        {conversation.dernier_message || 'Aucun message'}
                      </span>
                      {conversation.messages_non_lus_professionnels > 0 && (
                        <div className="unread-badge">
                          {conversation.messages_non_lus_professionnels}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Zone de chat */}
        <div className="chat-area">
          {selectedConversation ? (
            <>
              {/* Header de la conversation */}
              <div className="chat-header">
                <div className="chat-client-info">
                  <div className="client-avatar-large">
                    {selectedConversation.client_nom.charAt(0)}{selectedConversation.client_prenom?.charAt(0)}
                  </div>
                  <div className="client-details">
                    <h3>{selectedConversation.client_prenom} {selectedConversation.client_nom}</h3>
                    {selectedConversation.client_entreprise && (
                      <p className="client-company">{selectedConversation.client_entreprise}</p>
                    )}
                    <p className="client-email">{selectedConversation.client_email}</p>
                  </div>
                </div>
                
                <div className="chat-actions">
                  {/* Participants en ligne */}
                  {chat.participants.length > 0 && (
                    <div className="participants-info">
                      <span className="participants-count">
                        👥 {chat.participants.filter(p => p.en_ligne).length} en ligne
                      </span>
                    </div>
                  )}
                  
                  {/* Actions de conversation */}
                  <div className="conversation-actions">
                    {selectedConversation.statut === 'active' && chat.canCloseConversation && (
                      <button
                        className="action-btn close-btn"
                        onClick={() => handleCloseConversation(selectedConversation.id)}
                        title="Fermer la conversation"
                      >
                        🔒 Fermer
                      </button>
                    )}
                    
                    {selectedConversation.statut === 'fermee' && chat.canReopenConversation && (
                      <button
                        className="action-btn reopen-btn"
                        onClick={() => handleReopenConversation(selectedConversation.id)}
                        title="Rouvrir la conversation"
                      >
                        🔓 Rouvrir
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="messages-container">
                <div className="messages-list">
                  {chat.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`message ${
                        message.sender_type === 'user' ? 'message-own' : 'message-other'
                      } ${message.type_message === 'system' ? 'message-system' : ''}`}
                    >
                      {message.sender_type !== 'user' && message.type_message !== 'system' && (
                        <div className="message-sender">
                          {getMessageSenderDisplay(message)}
                        </div>
                      )}
                      <div className="message-content">
                        <div className="message-text">
                          {message.message}
                        </div>
                        <div className="message-time">
                          {formatTime(message.date_creation)}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Indicateur de frappe */}
                  {chat.typingUsers.length > 0 && (
                    <div className="typing-indicator">
                      <div className="typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                      <span className="typing-text">
                        Le client est en train d'écrire...
                      </span>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Zone de saisie */}
              {selectedConversation.statut === 'active' && (
                <div className="message-input-container">
                  <form onSubmit={handleSendMessage} className="message-form">
                    <div className="input-group">
                      <textarea
                        ref={inputRef}
                        value={messageInput}
                        onChange={handleInputChange}
                        onKeyPress={handleKeyPress}
                        placeholder={
                          chat.isConnected 
                            ? "Répondre au client..." 
                            : "Connexion en cours..."
                        }
                        disabled={!chat.canSendMessage}
                        className="message-input"
                        rows={1}
                      />
                      <button
                        type="submit"
                        disabled={!chat.canSendMessage || !messageInput.trim()}
                        className="send-button"
                      >
                        <span className="send-icon">📤</span>
                      </button>
                    </div>
                  </form>

                  {!chat.isConnected && (
                    <div className="connection-warning">
                      <span className="warning-icon">⚠️</span>
                      <span>Connexion au chat en cours...</span>
                    </div>
                  )}
                </div>
              )}
              
              {selectedConversation.statut === 'fermee' && (
                <div className="conversation-closed-notice">
                  <span className="notice-icon">🔒</span>
                  <span>Cette conversation est fermée</span>
                </div>
              )}
            </>
          ) : (
            /* Écran de sélection */
            <div className="no-conversation-selected">
              <div className="selection-content">
                <div className="selection-icon">💬</div>
                <h3>Sélectionnez une conversation</h3>
                <p>
                  Choisissez une conversation dans la liste pour commencer à discuter 
                  avec le client.
                </p>
                <div className="selection-tips">
                  <div className="tip">
                    <span className="tip-icon">🔵</span>
                    <span>Les conversations avec des messages non lus sont marquées</span>
                  </div>
                  <div className="tip">
                    <span className="tip-icon">🟢</span>
                    <span>Vous pouvez filtrer par statut ou rechercher par nom</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default ProfessionalChatModule;