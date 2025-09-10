import React, { useState, useRef, useEffect } from 'react';
import './NotificationBadge.css';

const NotificationBadge = ({ 
  unreadCount, 
  notifications, 
  onMarkAsRead, 
  onMarkAllAsRead,
  onDeleteNotification,
  onOpenPanel,
  isConnected,
  userRole
}) => {
  const [showPreview, setShowPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const previewRef = useRef(null);
  const badgeRef = useRef(null);

  // Fermer le preview si on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (previewRef.current && !previewRef.current.contains(event.target) &&
          badgeRef.current && !badgeRef.current.contains(event.target)) {
        setShowPreview(false);
      }
    };

    if (showPreview) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPreview]);

  // Fermer avec Escape
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && showPreview) {
        setShowPreview(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showPreview]);

  const getNotificationIcon = (type) => {
    const icons = {
      'facture_nouvelle': '📄',
      'paiement_recu': '💰',
      'client_nouveau': '👥',
      'demande_client': '📝',
      'modification_approuvee': '✅',
      'modification_rejetee': '❌',
      'mot_de_passe_approuve': '🔑',
      'mot_de_passe_rejete': '🚫',
      'facture_payee': '💰',
      'system': '⚙️'
    };
    return icons[type] || '🔔';
  };

  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'À l\'instant';
    if (diffMinutes < 60) return `Il y a ${diffMinutes}min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return date.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: '2-digit' 
    });
  };

  const handleBadgeClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowPreview(!showPreview);
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0 || isLoading) return;
    
    setIsLoading(true);
    try {
      await onMarkAllAsRead();
    } catch (error) {
      console.error('Erreur marquage toutes notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId, event) => {
    event?.stopPropagation();
    if (isLoading) return;

    setIsLoading(true);
    try {
      await onMarkAsRead(notificationId);
    } catch (error) {
      console.error('Erreur marquage notification:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteNotification = async (notificationId, event) => {
    event?.stopPropagation();
    if (isLoading) return;

    setIsLoading(true);
    try {
      await onDeleteNotification(notificationId);
    } catch (error) {
      console.error('Erreur suppression notification:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenPanel = () => {
    setShowPreview(false);
    onOpenPanel();
  };

  // Limiter les notifications affichées dans le preview
  const recentNotifications = notifications.slice(0, 5);

  return (
    <div className="notification-badge-container">
      {/* Badge principal */}
      <button 
        ref={badgeRef}
        className={`notification-badge ${!isConnected ? 'disconnected' : ''}`}
        onClick={handleBadgeClick}
        title={isConnected ? 
          `${unreadCount} notification${unreadCount !== 1 ? 's' : ''} non lue${unreadCount !== 1 ? 's' : ''}` :
          'Notifications déconnectées - Cliquez pour voir'
        }
        aria-label={`Notifications: ${unreadCount} non lues`}
        aria-expanded={showPreview}
      >
        <span className="badge-icon">🔔</span>
        
        {/* Compteur */}
        {unreadCount > 0 && (
          <span className="badge-count">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        
        {/* Indicateur de connexion */}
        <span className={`connection-indicator ${isConnected ? 'connected' : 'disconnected'}`} />
      </button>

      {/* Preview des notifications - Position fixe pour éviter l'expansion */}
      {showPreview && (
        <div ref={previewRef} className="notification-preview">
          <div className="preview-header">
            <h3>
              <span className="header-icon">🔔</span>
              Notifications
              {unreadCount > 0 && ` (${unreadCount})`}
            </h3>
            <div className="preview-actions">
              {unreadCount > 0 && (
                <button 
                  className="btn-mark-all"
                  onClick={handleMarkAllAsRead}
                  disabled={isLoading}
                  title="Marquer toutes comme lues"
                >
                  {isLoading ? '⏳' : '✅'} Tout marquer
                </button>
              )}
              <button 
                className="btn-open-panel"
                onClick={handleOpenPanel}
                title="Ouvrir le panneau complet"
              >
                📋 Voir tout
              </button>
            </div>
          </div>

          <div className="preview-content">
            {!isConnected && (
              <div className="connection-warning">
                <span className="warning-icon">⚠️</span>
                <span>Connexion notifications interrompue</span>
              </div>
            )}

            {recentNotifications.length === 0 ? (
              <div className="no-notifications">
                <span className="empty-icon">📭</span>
                <p>Aucune notification récente</p>
              </div>
            ) : (
              <div className="notifications-list">
                {recentNotifications.map((notification, index) => (
                  <div 
                    key={notification.id}
                    className={`notification-item ${!notification.lu ? 'unread' : 'read'} ${index === 0 && !notification.lu ? 'new' : ''}`}
                  >
                    <div className="notification-icon">
                      {getNotificationIcon(notification.type)}
                    </div>
                    
                    <div className="notification-content">
                      <div className="notification-title">
                        {notification.titre}
                      </div>
                      <div className="notification-message">
                        {notification.message}
                      </div>
                      <div className="notification-time">
                        {formatRelativeTime(notification.date_creation)}
                      </div>
                    </div>
                    
                    <div className="notification-actions">
                      {!notification.lu && (
                        <button 
                          className="btn-mark-read"
                          onClick={(e) => handleMarkAsRead(notification.id, e)}
                          disabled={isLoading}
                          title="Marquer comme lu"
                        >
                          ✅
                        </button>
                      )}
                      <button 
                        className="btn-delete"
                        onClick={(e) => handleDeleteNotification(notification.id, e)}
                        disabled={isLoading}
                        title="Supprimer"
                      >
                        🗑️
                      </button>
                    </div>
                    
                    {!notification.lu && <div className="unread-dot" />}
                  </div>
                ))}
              </div>
            )}

            {notifications.length > 5 && (
              <div className="preview-footer">
                <button 
                  className="btn-see-all"
                  onClick={handleOpenPanel}
                >
                  Voir toutes les notifications ({notifications.length})
                </button>
              </div>
            )}
          </div>

          {/* État de chargement */}
          {isLoading && (
            <div className="loading-notifications">
              <div className="loading-spinner"></div>
              <span>Traitement...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBadge;