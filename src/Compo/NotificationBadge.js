// src/components/NotificationBadge.js
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
  userRole // Pour permissions admin
}) => {
  const [showPreview, setShowPreview] = useState(false);
  const previewRef = useRef(null);

  // Fermer le preview si on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (previewRef.current && !previewRef.current.contains(event.target)) {
        setShowPreview(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
    return date.toLocaleDateString('fr-FR');
  };

  const recentNotifications = notifications.slice(0, 5);

  return (
    <div className="notification-badge-container" ref={previewRef}>
      {/* Badge principal */}
      <button 
        className={`notification-badge ${!isConnected ? 'disconnected' : ''}`}
        onClick={() => setShowPreview(!showPreview)}
        title={isConnected ? 
          `${unreadCount} notification${unreadCount !== 1 ? 's' : ''} non lue${unreadCount !== 1 ? 's' : ''}` :
          'Notifications déconnectées'
        }
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

      {/* Preview des notifications */}
      {showPreview && (
        <div className="notification-preview">
          <div className="preview-header">
            <h3>Notifications</h3>
            <div className="preview-actions">
              {unreadCount > 0 && (
                <button 
                  className="btn-mark-all"
                  onClick={onMarkAllAsRead}
                  title="Marquer toutes comme lues"
                >
                  ✅
                </button>
              )}
              <button 
                className="btn-open-panel"
                onClick={() => {
                  setShowPreview(false);
                  onOpenPanel();
                }}
                title="Ouvrir le panneau complet"
              >
                📋
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
                <p>Aucune notification</p>
              </div>
            ) : (
              <div className="notifications-list">
                {recentNotifications.map((notification) => (
                  <div 
                    key={notification.id}
                    className={`notification-item ${!notification.lu ? 'unread' : 'read'}`}
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
                          onClick={(e) => {
                            e.stopPropagation();
                            onMarkAsRead(notification.id);
                          }}
                          title="Marquer comme lu"
                        >
                          ✅
                        </button>
                      )}
                      <button 
                        className="btn-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteNotification(notification.id);
                        }}
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
                  onClick={() => {
                    setShowPreview(false);
                    onOpenPanel();
                  }}
                >
                  Voir toutes les notifications ({notifications.length})
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBadge;