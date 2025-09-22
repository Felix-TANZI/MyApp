import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ClientInvoicesModule from './Client/ClientInvoicesModule';
import ClientProfileModule from './Client/ClientProfileModule';
import ClientNotificationsModule from './Client/ClientNotificationsModule';
import NotificationBadge from './NotificationBadge';
import NotificationPanel from './NotificationPanel';
import './DashboardClient.css';

const DashboardClient = () => {
  const { user, logout, notifications } = useAuth();
  const [currentModule, setCurrentModule] = useState('dashboard');
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [stats, setStats] = useState({
    total_factures: 0,
    montant_total: 0,
    factures_payees: 0,
    factures_en_attente: 0,
    factures_en_retard: 0,
    montant_paye: 0,
    montant_en_attente: 0
  });
  const [loading, setLoading] = useState(true);

  // Destructurer les fonctions et état des notifications
  const {
    notifications: notificationList = [],
    unreadCount = 0,
    isConnected = false,
    error: notificationError,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    loadNotifications
  } = notifications || {};

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Récupérer les statistiques
      const statsResponse = await fetch('http://localhost:5000/api/client/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.data);
      }

    } catch (error) {
      console.error('Erreur récupération données dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Erreur déconnexion:', error);
    }
  };

  const handleOpenNotificationPanel = () => {
    setShowNotificationPanel(true);
  };

  const handleCloseNotificationPanel = () => {
    setShowNotificationPanel(false);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
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
    const diffHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'À l\'instant';
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffHours < 48) return 'Hier';
    return date.toLocaleDateString('fr-FR');
  };

  const renderCurrentModule = () => {
    switch(currentModule) {
      case 'invoices':
        return <ClientInvoicesModule onBack={() => setCurrentModule('dashboard')} />;
      case 'profile':
        return <ClientProfileModule onBack={() => setCurrentModule('dashboard')} />;
      case 'notifications':
        return <ClientNotificationsModule onBack={() => setCurrentModule('dashboard')} />;
      default:
        return renderDashboard();
    }
  };

  const renderDashboard = () => (
    <>
      {/* Section de bienvenue */}
      <div className="welcome-section">
        <h1>Bonjour {user?.prenom} !</h1>
        <p>Consultez et gérez vos factures via Amani</p>
        {/* Statut de connexion notifications */}
        {!isConnected && (
          <div className="connection-warning">
            <span className="warning-icon">⚠️</span>
            <span>Notifications temps réel temporairement indisponibles</span>
          </div>
        )}
      </div>

      {/* Statistiques */}
      <div className="client-stats">
        <div className="stat-card">
          <div className="stat-icon blue">📄</div>
          <div className="stat-content">
            <h3>{stats.total_factures}</h3>
            <p>Factures totales</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">💰</div>
          <div className="stat-content">
            <h3>{formatCurrency(stats.montant_total)}</h3>
            <p>Montant total</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon success">✅</div>
          <div className="stat-content">
            <h3>{stats.factures_payees}</h3>
            <p>Factures payées</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon warning">⏳</div>
          <div className="stat-content">
            <h3>{stats.factures_en_attente}</h3>
            <p>En attente</p>
          </div>
        </div>

        {/* Nouvelle carte pour notifications */}
        <div className="stat-card notification-stat">
          <div className="stat-icon purple">🔔</div>
          <div className="stat-content">
            <h3>{unreadCount || 0}</h3>
            <p>Notifications non lues</p>
          </div>
          {isConnected && (
            <div className="connection-indicator connected" title="Notifications en temps réel actives"></div>
          )}
          {!isConnected && (
            <div className="connection-indicator disconnected" title="Connexion notifications interrompue"></div>
          )}
        </div>
      </div>

      {/* Actions rapides */}
      <div className="quick-actions-section">
        <h2>Actions rapides</h2>
        <div className="quick-actions-grid">
          <button 
            className="quick-action-card"
            onClick={() => setCurrentModule('invoices')}
          >
            <div className="action-icon">📋</div>
            <div className="action-content">
              <h3>Mes factures</h3>
              <p>Consulter toutes mes factures</p>
            </div>
            <div className="action-arrow">→</div>
          </button>

          <button 
            className="quick-action-card"
            onClick={() => setCurrentModule('profile')}
          >
            <div className="action-icon">👤</div>
            <div className="action-content">
              <h3>Mon profil</h3>
              <p>Gérer mes informations</p>
            </div>
            <div className="action-arrow">→</div>
          </button>

          <button 
            className="quick-action-card"
            onClick={() => setCurrentModule('notifications')}
          >
            <div className="action-icon">🔔</div>
            <div className="action-content">
              <h3>Notifications</h3>
              <p>{unreadCount > 0 ? `${unreadCount} non lues` : 'Toutes lues'}</p>
            </div>
            <div className="action-arrow">→</div>
            {unreadCount > 0 && <div className="notification-badge">{unreadCount}</div>}
          </button>

          <a 
            href="mailto:tanzifelix@gmail.com"
            className="quick-action-card contact-card"
          >
            <div className="action-icon">📞</div>
            <div className="action-content">
              <h3>Support</h3>
              <p>Contactez notre équipe</p>
            </div>
            <div className="action-arrow">↗</div>
          </a>
        </div>
      </div>

      {/* Notifications récentes */}
      {notificationList && notificationList.length > 0 && (
        <div className="recent-notifications-section">
          <div className="section-header">
            <h2>Notifications récentes</h2>
            <button 
              className="btn-secondary"
              onClick={() => setCurrentModule('notifications')}
            >
              Voir toutes
            </button>
          </div>
          <div className="notifications-preview">
            {notificationList.slice(0, 3).map((notification) => (
              <div 
                key={notification.id} 
                className={`notification-preview ${!notification.lu ? 'unread' : ''}`}
                onClick={() => !notification.lu && markAsRead && markAsRead(notification.id)}
                style={{ cursor: !notification.lu ? 'pointer' : 'default' }}
              >
                <div className="notification-icon">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="notification-content">
                  <h4>{notification.titre}</h4>
                  <p>{notification.message}</p>
                  <span className="notification-time">
                    {formatRelativeTime(notification.date_creation)}
                  </span>
                </div>
                {!notification.lu && <div className="unread-indicator"></div>}
                <div className="notification-actions">
                  {!notification.lu && markAsRead && (
                    <button 
                      className="btn-mark-read"
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(notification.id);
                      }}
                      title="Marquer comme lu"
                    >
                      ✅
                    </button>
                  )}
                  {deleteNotification && (
                    <button 
                      className="btn-delete-notif"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                      title="Supprimer"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Informations de contact */}
      <div className="contact-section">
        <h2>Besoin d'aide ?</h2>
        <div className="contact-cards">
          <div className="contact-card">
            <span className="contact-icon">📧</span>
            <div>
              <h4>Email</h4>
              <p>tanzifelix@gmail.com</p>
            </div>
          </div>
          <div className="contact-card">
            <span className="contact-icon">📖</span>
            <div>
              <h4>Documentation</h4>
              <p>Guide d'utilisation en ligne</p>
            </div>
          </div>
          <div className="contact-card">
            <span className="contact-icon">🇨🇲</span>
            <div>
              <h4>Développé au Cameroun</h4>
              <p>Solution hôtelière locale</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  if (loading) {
    return (
      <div className="dashboard-client">
        <div className="loading-dashboard">
          <div className="loading-spinner"></div>
          <p>Chargement de votre espace client...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-client">
      {/* Header */}
      <header className="client-header">
        <div className="header-content">
          <div className="header-left">
            <div className="logo-section">
              <span className="logo-icon">🏨</span>
              <span className="logo-text">Amani</span>
            </div>
            <div className="page-title">Espace Client</div>
          </div>
          
          <div className="header-right">
            {/* Badge de notification - uniquement si les composants sont disponibles */}
            {NotificationBadge && (
              <NotificationBadge
                unreadCount={unreadCount}
                notifications={notificationList}
                onMarkAsRead={markAsRead}
                onMarkAllAsRead={markAllAsRead}
                onDeleteNotification={deleteNotification}
                onOpenPanel={handleOpenNotificationPanel}
                isConnected={isConnected}
                userRole="client"
              />
            )}

            <div className="client-info">
              <div className="client-avatar">
                {user?.nom?.charAt(0)}{user?.prenom?.charAt(0)}
              </div>
              <div className="client-details">
                <div className="client-name">
                  {user?.prenom} {user?.nom}
                </div>
                <div className="client-code">
                  {user?.code_client}
                </div>
              </div>
            </div>
            
            {/* Navigation si on est dans un module */}
            {currentModule !== 'dashboard' && (
              <button 
                className="btn-back"
                onClick={() => setCurrentModule('dashboard')}
              >
                ← Retour
              </button>
            )}
            
            <button className="logout-btn" onClick={handleLogout}>
              <span>🚪</span>
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="client-main">
        <div className="client-container">
          {/* Afficher les erreurs de notification */}
          {notificationError && (
            <div className="notification-error">
              <span className="error-icon">⚠️</span>
              <span>Erreur notifications: {notificationError}</span>
            </div>
          )}

          {renderCurrentModule()}
        </div>
      </main>

      {/* Panneau de notifications - uniquement si le composant est disponible */}
      {showNotificationPanel && NotificationPanel && (
        <NotificationPanel
          notifications={notificationList}
          unreadCount={unreadCount}
          isConnected={isConnected}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
          onDeleteNotification={deleteNotification}
          onClearAllNotifications={clearAllNotifications}
          onLoadMore={() => loadNotifications && loadNotifications(Math.ceil(notificationList.length / 20) + 1)}
          onClose={handleCloseNotificationPanel}
          userRole="client"
        />
      )}
    </div>
  );
};

export default DashboardClient;