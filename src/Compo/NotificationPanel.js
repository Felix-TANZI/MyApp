// src/components/NotificationPanel.js
import React, { useState, useEffect } from 'react';
import './NotificationPanel.css';

const NotificationPanel = ({ 
  notifications, 
  unreadCount,
  isConnected,
  onMarkAsRead, 
  onMarkAllAsRead,
  onDeleteNotification,
  onClearAllNotifications,
  onLoadMore,
  onClose,
  userRole // Pour permissions admin
}) => {
  const [filter, setFilter] = useState('all'); // 'all', 'unread', 'read'
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedNotifications, setSelectedNotifications] = useState(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  // Types de notifications avec labels
  const notificationTypes = {
    'all': 'Toutes',
    'facture_nouvelle': 'Nouvelles factures',
    'paiement_recu': 'Paiements reçus',
    'client_nouveau': 'Nouveaux clients',
    'demande_client': 'Demandes clients',
    'modification_approuvee': 'Modifications approuvées',
    'modification_rejetee': 'Modifications rejetées',
    'mot_de_passe_approuve': 'Mots de passe approuvés',
    'mot_de_passe_rejete': 'Mots de passe rejetés',
    'facture_payee': 'Factures payées'
  };

  // Filtrer les notifications
  const filteredNotifications = notifications.filter(notification => {
    const statusMatch = filter === 'all' || 
                       (filter === 'unread' && !notification.lu) || 
                       (filter === 'read' && notification.lu);
    
    const typeMatch = typeFilter === 'all' || notification.type === typeFilter;
    
    return statusMatch && typeMatch;
  });

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

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
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
    return formatDate(dateString);
  };

  // Sélection multiple
  const toggleSelection = (notificationId) => {
    const newSelection = new Set(selectedNotifications);
    if (newSelection.has(notificationId)) {
      newSelection.delete(notificationId);
    } else {
      newSelection.add(notificationId);
    }
    setSelectedNotifications(newSelection);
  };

  const selectAll = () => {
    if (selectedNotifications.size === filteredNotifications.length) {
      setSelectedNotifications(new Set());
    } else {
      setSelectedNotifications(new Set(filteredNotifications.map(n => n.id)));
    }
  };

  // Actions en lot
  const handleBulkMarkAsRead = async () => {
    setLoading(true);
    try {
      const unreadSelected = Array.from(selectedNotifications).filter(id => {
        const notif = notifications.find(n => n.id === id);
        return notif && !notif.lu;
      });

      for (const id of unreadSelected) {
        await onMarkAsRead(id);
      }
      
      setSelectedNotifications(new Set());
    } catch (error) {
      console.error('Erreur marquage en lot:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    setLoading(true);
    try {
      for (const id of selectedNotifications) {
        await onDeleteNotification(id);
      }
      
      setSelectedNotifications(new Set());
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Erreur suppression en lot:', error);
    } finally {
      setLoading(false);
    }
  };

  // Raccourcis clavier
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'a' && e.ctrlKey) {
        e.preventDefault();
        selectAll();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, selectAll]);

  return (
    <div className="notification-panel-overlay">
      <div className="notification-panel">
        {/* Header */}
        <div className="panel-header">
          <div className="header-left">
            <h2>
              🔔 Notifications
              {unreadCount > 0 && (
                <span className="header-badge">{unreadCount}</span>
              )}
            </h2>
            <div className="connection-status">
              <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
              <span className="status-text">
                {isConnected ? 'Temps réel activé' : 'Connexion interrompue'}
              </span>
            </div>
          </div>
          
          <button className="btn-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Filtres */}
        <div className="panel-filters">
          <div className="filter-group">
            <label>Statut:</label>
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">Toutes ({notifications.length})</option>
              <option value="unread">Non lues ({unreadCount})</option>
              <option value="read">Lues ({notifications.length - unreadCount})</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Type:</label>
            <select 
              value={typeFilter} 
              onChange={(e) => setTypeFilter(e.target.value)}
              className="filter-select"
            >
              {Object.entries(notificationTypes).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Actions en lot */}
        {selectedNotifications.size > 0 && (
          <div className="bulk-actions">
            <div className="bulk-info">
              <span>{selectedNotifications.size} sélectionnée(s)</span>
            </div>
            <div className="bulk-buttons">
              <button 
                className="btn-bulk btn-read"
                onClick={handleBulkMarkAsRead}
                disabled={loading}
              >
                ✅ Marquer comme lues
              </button>
              <button 
                className="btn-bulk btn-delete"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading}
              >
                🗑️ Supprimer
              </button>
              <button 
                className="btn-bulk btn-cancel"
                onClick={() => setSelectedNotifications(new Set())}
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Actions globales */}
        <div className="global-actions">
          <button 
            className="btn-action btn-select-all"
            onClick={selectAll}
          >
            {selectedNotifications.size === filteredNotifications.length ? 
              '❌ Désélectionner tout' : 
              '☑️ Sélectionner tout'
            }
          </button>
          
          {unreadCount > 0 && (
            <button 
              className="btn-action btn-mark-all-read"
              onClick={onMarkAllAsRead}
              disabled={loading}
            >
              ✅ Marquer toutes comme lues
            </button>
          )}
          
          <button 
            className="btn-action btn-clear-read"
            onClick={() => onClearAllNotifications(true)}
            disabled={loading}
          >
            🧹 Supprimer les lues
          </button>
          
          {/* Admin seulement */}
          {userRole === 'admin' && (
            <button 
              className="btn-action btn-clear-all"
              onClick={() => onClearAllNotifications(false)}
              disabled={loading}
            >
              🗑️ Tout supprimer
            </button>
          )}
        </div>

        {/* Liste des notifications */}
        <div className="panel-content">
          {filteredNotifications.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📭</span>
              <h3>Aucune notification</h3>
              <p>
                {filter === 'unread' ? 
                  'Toutes vos notifications ont été lues !' :
                  'Vous n\'avez pas encore de notifications.'
                }
              </p>
            </div>
          ) : (
            <div className="notifications-list">
              {filteredNotifications.map((notification) => (
                <div 
                  key={notification.id}
                  className={`notification-item ${!notification.lu ? 'unread' : 'read'} ${
                    selectedNotifications.has(notification.id) ? 'selected' : ''
                  }`}
                >
                  <div className="item-left">
                    <input
                      type="checkbox"
                      checked={selectedNotifications.has(notification.id)}
                      onChange={() => toggleSelection(notification.id)}
                      className="item-checkbox"
                    />
                    
                    <div className="notification-icon">
                      {getNotificationIcon(notification.type)}
                    </div>
                  </div>
                  
                  <div className="item-content">
                    <div className="notification-header">
                      <h4 className="notification-title">
                        {notification.titre}
                      </h4>
                      <div className="notification-meta">
                        <span className="notification-time">
                          {formatRelativeTime(notification.date_creation)}
                        </span>
                        <span className="notification-type">
                          {notificationTypes[notification.type] || notification.type}
                        </span>
                      </div>
                    </div>
                    
                    <p className="notification-message">
                      {notification.message}
                    </p>
                    
                    {notification.data && (
                      <div className="notification-data">
                        {notification.data.facture_id && (
                          <span className="data-tag">
                            📄 Facture #{notification.data.numero || notification.data.facture_id}
                          </span>
                        )}
                        {notification.data.montant && (
                          <span className="data-tag">
                            💰 {new Intl.NumberFormat('fr-FR').format(notification.data.montant)} XAF
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="item-actions">
                    {!notification.lu && (
                      <button 
                        className="btn-item-action btn-mark-read"
                        onClick={() => onMarkAsRead(notification.id)}
                        title="Marquer comme lu"
                      >
                        ✅
                      </button>
                    )}
                    <button 
                      className="btn-item-action btn-delete"
                      onClick={() => onDeleteNotification(notification.id)}
                      title="Supprimer"
                    >
                      🗑️
                    </button>
                  </div>
                  
                  {!notification.lu && <div className="unread-indicator" />}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="panel-footer">
          <div className="footer-info">
            Affichage: {filteredNotifications.length} / {notifications.length} notifications
          </div>
          
          {filteredNotifications.length < notifications.length && (
            <button 
              className="btn-load-more"
              onClick={onLoadMore}
              disabled={loading}
            >
              {loading ? 'Chargement...' : 'Charger plus'}
            </button>
          )}
        </div>
      </div>

      {/* Confirmation de suppression */}
      {showDeleteConfirm && (
        <div className="delete-confirm-overlay">
          <div className="delete-confirm">
            <h3>Confirmer la suppression</h3>
            <p>
              Êtes-vous sûr de vouloir supprimer {selectedNotifications.size} notification(s) ?
              Cette action est irréversible.
            </p>
            <div className="confirm-actions">
              <button 
                className="btn-confirm btn-danger"
                onClick={handleBulkDelete}
                disabled={loading}
              >
                {loading ? 'Suppression...' : 'Supprimer'}
              </button>
              <button 
                className="btn-confirm btn-cancel"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;