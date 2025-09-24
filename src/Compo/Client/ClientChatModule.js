import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import useChat from '../../hooks/useChat';
import './ClientChatModule.css';

const ClientChatModule = ({ onBack }) => {
  const { user } = useAuth();
  const chat = useChat(user, 'client');
  const [messageInput, setMessageInput] = useState('');
  const [showWelcome, setShowWelcome] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll vers le bas quand de nouveaux messages arrivent
  useEffect(() => {
    scrollToBottom();
  }, [chat.messages]);

  // Auto-focus sur l'input quand on rejoint une conversation
  useEffect(() => {
    if (chat.currentConversation && inputRef.current) {
      inputRef.current.focus();
    }
  }, [chat.currentConversation]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleStartChat = async () => {
    setShowWelcome(false);
    
    // Vérifier s'il y a déjà une conversation active
    if (chat.conversations.length > 0) {
      const activeConv = chat.conversations.find(conv => conv.statut === 'active');
      if (activeConv) {
        await chat.joinConversation(activeConv.id);
        return;
      }
    }

    // Créer une nouvelle conversation
    const newConv = await chat.createConversation('Support client');
    if (newConv) {
      await chat.joinConversation(newConv.conversation_id || newConv.id);
    }
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
    if (message.sender_type === 'client') {
      return 'Vous';
    }
    
    if (message.sender_type === 'assistant') {
      return '🤖 Assistant Amani';
    }
    
    const role = message.sender_role;
    const roleLabels = {
      'admin': '👑 Administrateur',
      'commercial': '💼 Commercial', 
      'comptable': '📊 Comptable'
    };
    
    return roleLabels[role] || '👤 Équipe support';
  };

  const renderWelcomeScreen = () => (
    <div className="chat-welcome">
      <div className="welcome-content">
        <div className="welcome-icon">💬</div>
        <h2>Contactez notre équipe</h2>
        <p>
          Notre équipe est là pour vous aider avec toutes vos questions concernant 
          vos factures, votre compte, ou tout autre besoin. 
          <br/><br/>
          <strong>🤖 Assistant Amani</strong> peut vous répondre immédiatement 
          en attendant qu'un membre de notre équipe soit disponible.
        </p>
        <div className="welcome-features">
          <div className="feature">
            <span className="feature-icon">⚡</span>
            <span>Réponse rapide</span>
          </div>
          <div className="feature">
            <span className="feature-icon">🤖</span>
            <span>Assistant IA 24/7</span>
          </div>
          <div className="feature">
            <span className="feature-icon">🏨</span>
            <span>Support professionnel</span>
          </div>
          <div className="feature">
            <span className="feature-icon">🇨🇲</span>
            <span>Équipe locale</span>
          </div>
        </div>
        <button className="start-chat-btn" onClick={handleStartChat} disabled={chat.loading}>
          {chat.loading ? 'Connexion...' : 'Commencer la discussion'}
        </button>
      </div>
    </div>
  );

  const renderChatInterface = () => (
    <div className="chat-interface">
      {/* Header du chat */}
      <div className="chat-header">
        <div className="chat-title">
          <h3>Support Client - {chat.currentConversation?.sujet}</h3>
          <div className="connection-status">
            {chat.isConnected ? (
              <span className="status-connected">
                <span className="status-dot"></span>
                En ligne
              </span>
            ) : (
              <span className="status-disconnected">
                <span className="status-dot"></span>
                Déconnecté
              </span>
            )}
          </div>
        </div>

        {/* Participants en ligne - Inclure l'assistant s'il est actif */}
        {(chat.participants.length > 0 || chat.isAssistantActive) && (
          <div className="online-participants">
            <span className="participants-label">En ligne:</span>
            {chat.participants
              .filter(p => p.en_ligne && p.user_type === 'user')
              .map(participant => (
                <span key={`${participant.user_type}-${participant.user_id}`} className="participant">
                  {getMessageSenderDisplay({ sender_type: 'user', sender_role: participant.role })}
                </span>
              ))}
            {/* Indicateur Assistant Amani actif */}
            {chat.isAssistantActive && (
              <span className="participant assistant-active">
                🤖 Assistant Amani
              </span>
            )}
          </div>
        )}
      </div>

      {/* Zone des messages */}
      <div className="messages-container">
        <div className="messages-list">
          {chat.messages.map((message) => (
            <div
              key={message.id}
              className={`message ${
                message.sender_type === 'client' ? 'message-own' : 
                message.sender_type === 'assistant' ? 'message-assistant' : 'message-other'
              } ${message.type_message === 'system' ? 'message-system' : ''}`}
            >
              {message.sender_type !== 'client' && message.type_message !== 'system' && (
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
          
          {/* Indicateur de frappe - Mis à jour pour l'assistant */}
          {chat.typingUsers.length > 0 && (
            <div className={`typing-indicator ${chat.typingUsers.some(u => u.userType === 'assistant') ? 'assistant-typing' : ''}`}>
              <div className="typing-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span className="typing-text">
                {chat.typingUsers.some(u => u.userType === 'assistant') 
                  ? 'Assistant Amani est en train d\'analyser votre demande...'
                  : 'L\'équipe support est en train d\'écrire...'}
              </span>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Zone de saisie */}
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
                  ? "Tapez votre message..." 
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

        {/* Indicateur Assistant Amani actif */}
        {chat.isAssistantActive && (
          <div className="assistant-indicator">
            <span className="assistant-icon">🤖</span>
            <span>Assistant Amani est disponible pour vous aider en attendant notre équipe</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="client-chat-module">
      {/* Header */}
      <div className="module-header">
        <div className="header-left">
          <button className="back-btn" onClick={onBack}>
            ← Retour
          </button>
          <h1>Support Client</h1>
        </div>
        <div className="header-right">
          {chat.currentConversation && (
            <div className="conversation-info">
              <span className="conversation-status">
                {chat.currentConversation.statut === 'active' ? '🟢 Active' : '🔴 Fermée'}
              </span>
            </div>
          )}
          {/* Indicateur statut assistant dans le header */}
          {chat.isAssistantActive && (
            <div className="assistant-status">
              <span className="assistant-status-dot"></span>
              <span>Assistant IA</span>
            </div>
          )}
        </div>
      </div>

      {/* Contenu principal */}
      <div className="chat-content">
        {chat.error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            <span>{chat.error}</span>
            <button onClick={chat.clearError} className="error-close">×</button>
          </div>
        )}

        {showWelcome && !chat.currentConversation ? (
          renderWelcomeScreen()
        ) : (
          renderChatInterface()
        )}
      </div>

      {/* Informations en bas */}
      <div className="chat-footer">
        <div className="support-info">
          <span className="info-text">
            {chat.isAssistantActive 
              ? '🤖 Assistant Amani vous aide en attendant notre équipe. Réponses instantanées disponibles.'
              : '💡 Notre équipe répond généralement en quelques minutes pendant les heures d\'ouverture.'
            }
          </span>
        </div>
      </div>
    </div>
  );
};

export default ClientChatModule;