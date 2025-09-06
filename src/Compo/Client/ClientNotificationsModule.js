import React, { useState, useEffect } from 'react';

const ClientNotificationsModule = ({ onBack }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchNotifications();
  }, [currentPage]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/client/notifications?page=${currentPage}&limit=10`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors du chargement des notifications');
      }

      const data = await response.json();
      setNotifications(data.data.notifications);
      setPagination(data.data.pagination);
      setUnreadCount(data.data.unread_count);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/client/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Mettre à jour l'état local
        setNotifications(notifications.map(notif => 
          notif.id === notificationId ? { ...notif, lu: true } : notif
        ));
        setUnreadCount(Math.max(0, unreadCount - 1));
      }
    } catch (err) {
      console.error('Erreur lors du marquage comme lu:', err);
    }
  };

  const getNotificationIcon = (type) => {
    const icons = {
      'modification_approuvee': '✅',
      'modification_rejetee': '❌',
      'mot_de_passe_approuve': '🔑',
      'mot_de_passe_rejete': '🚫',
      'facture_nouvelle': '📄',
      'facture_payee': '💰',
      'info': 'ℹ️'
    };
    return icons[type] || 'ℹ️';
  };

  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) return 'À l\'instant';
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
    return date.toLocaleDateString('fr-FR');
  };

  const containerStyle = {
    padding: '24px',
    backgroundColor: '#f8fafc',
    minHeight: '100vh'
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  };

  const titleStyle = {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1e293b',
    margin: 0
  };

  const backButtonStyle = {
    padding: '8px 16px',
    backgroundColor: '#e2e8f0',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  };

  const statsStyle = {
    display: 'flex',
    gap: '16px',
    marginBottom: '24px'
  };

  const statCardStyle = {
    backgroundColor: 'white',
    padding: '16px',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    minWidth: '150px'
  };

  const notificationStyle = (isRead) => ({
    backgroundColor: 'white',
    border: `1px solid ${isRead ? '#e5e7eb' : '#3b82f6'}`,
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '12px',
    cursor: 'pointer',
    boxShadow: isRead ? '0 1px 3px rgba(0,0,0,0.1)' : '0 2px 8px rgba(59,130,246,0.15)',
    position: 'relative'
  });

  const notificationHeaderStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '8px'
  };

  const notificationIconStyle = {
    fontSize: '20px',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    backgroundColor: '#f3f4f6'
  };

  const notificationTitleStyle = {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1e293b',
    flex: 1
  };

  const notificationTimeStyle = {
    fontSize: '12px',
    color: '#6b7280'
  };

  const notificationMessageStyle = {
    fontSize: '14px',
    color: '#4b5563',
    lineHeight: '1.5'
  };

  const unreadIndicatorStyle = {
    position: 'absolute',
    top: '12px',
    right: '12px',
    width: '8px',
    height: '8px',
    backgroundColor: '#3b82f6',
    borderRadius: '50%'
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '48px' }}>
          <p>Chargement de vos notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>Mes Notifications</h1>
        <button style={backButtonStyle} onClick={onBack}>
          ← Retour
        </button>
      </div>

      {error && (
        <div style={{
          padding: '12px',
          backgroundColor: '#fecaca',
          color: '#dc2626',
          borderRadius: '6px',
          marginBottom: '16px'
        }}>
          {error}
        </div>
      )}

      {/* Statistiques */}
      <div style={statsStyle}>
        <div style={statCardStyle}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>
            {notifications.length}
          </h3>
          <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
            Total notifications
          </p>
        </div>
        <div style={statCardStyle}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: '700', color: '#3b82f6' }}>
            {unreadCount}
          </h3>
          <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
            Non lues
          </p>
        </div>
      </div>

      {/* Liste des notifications */}
      {notifications.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '48px',
          backgroundColor: 'white',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔔</div>
          <h3>Aucune notification</h3>
          <p>Vous n'avez pas encore de notifications.</p>
        </div>
      ) : (
        <div>
          {notifications.map((notification) => (
            <div
              key={notification.id}
              style={notificationStyle(notification.lu)}
              onClick={() => !notification.lu && markAsRead(notification.id)}
            >
              {!notification.lu && <div style={unreadIndicatorStyle}></div>}
              
              <div style={notificationHeaderStyle}>
                <div style={notificationIconStyle}>
                  {getNotificationIcon(notification.type)}
                </div>
                <div style={notificationTitleStyle}>
                  {notification.titre}
                </div>
                <div style={notificationTimeStyle}>
                  {formatRelativeTime(notification.date_creation)}
                </div>
              </div>
              
              <div style={notificationMessageStyle}>
                {notification.message}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '24px',
          padding: '16px',
          backgroundColor: 'white',
          borderRadius: '8px'
        }}>
          <button
            disabled={!pagination.hasPrev}
            onClick={() => setCurrentPage(currentPage - 1)}
            style={{
              padding: '8px 16px',
              backgroundColor: pagination.hasPrev ? '#3b82f6' : '#e5e7eb',
              color: pagination.hasPrev ? 'white' : '#9ca3af',
              border: 'none',
              borderRadius: '6px',
              cursor: pagination.hasPrev ? 'pointer' : 'not-allowed'
            }}
          >
            ← Précédent
          </button>
          <span style={{ fontSize: '14px', color: '#6b7280' }}>
            Page {pagination.page} sur {pagination.totalPages}
          </span>
          <button
            disabled={!pagination.hasNext}
            onClick={() => setCurrentPage(currentPage + 1)}
            style={{
              padding: '8px 16px',
              backgroundColor: pagination.hasNext ? '#3b82f6' : '#e5e7eb',
              color: pagination.hasNext ? 'white' : '#9ca3af',
              border: 'none',
              borderRadius: '6px',
              cursor: pagination.hasNext ? 'pointer' : 'not-allowed'
            }}
          >
            Suivant →
          </button>
        </div>
      )}
    </div>
  );
};

export default ClientNotificationsModule;