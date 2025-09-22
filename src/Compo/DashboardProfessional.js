import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ClientsModule from './ClientsModule';
import InvoicesModule from './InvoicesModule';
import UsersModule from './UsersModule';
import AdminRequestsModule from './AdminRequestsModule';
import NotificationBadge from './NotificationBadge';
import NotificationPanel from './NotificationPanel';
import './DashboardProfessional.css';

const DashboardProfessional = () => {
  const { user, logout, isAdmin, notifications } = useAuth();
  const [currentModule, setCurrentModule] = useState('overview');
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [requestsStats, setRequestsStats] = useState({
    total_demandes: 0,
    demandes_profil: 0,
    demandes_mot_de_passe: 0
  });

  // Destructurer les fonctions et état des notifications
  const {
    notifications: notificationList,
    unreadCount,
    isConnected,
    error: notificationError,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    loadNotifications
  } = notifications;

  // Charger les statistiques des demandes admin
  const loadRequestsStats = useCallback(async () => {
    if (!user || (user.role !== 'admin' && user.role !== 'commercial' && user.role !== 'comptable')) {
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/requests/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setRequestsStats(data.data.global || { 
            total_demandes: 0,
            demandes_profil: 0,
            demandes_mot_de_passe: 0
          });
        }
      }
    } catch (error) {
      console.error('Erreur chargement stats demandes:', error);
    }
  }, [user]);

  // Effet pour charger les stats des demandes
  useEffect(() => {
    loadRequestsStats();
    
    // Recharger toutes les 30 secondes
    const interval = setInterval(loadRequestsStats, 30000);
    return () => clearInterval(interval);
  }, [loadRequestsStats]);

  // Modules disponibles selon le rôle avec badge notifications
  const modules = [
    {
      id: 'overview',
      name: 'Vue d\'ensemble',
      icon: '📊',
      description: 'Tableau de bord et statistiques',
      color: 'from-blue-500 to-blue-600',
      roles: ['admin', 'commercial', 'comptable']
    },
    {
      id: 'clients',
      name: 'Clients',
      icon: '👥',
      description: 'Gestion des clients',
      color: 'from-green-500 to-green-600',
      roles: ['admin', 'commercial', 'comptable']
    },
    {
      id: 'invoices', 
      name: 'Factures',
      icon: '📄',
      description: 'Création et gestion des factures',
      color: 'from-purple-500 to-purple-600',
      roles: ['admin', 'commercial', 'comptable']
    },
    {
      id: 'requests',
      name: 'Demandes',
      icon: '📝',
      description: 'Demandes clients en attente',
      color: 'from-orange-500 to-orange-600',
      roles: ['admin', 'commercial', 'comptable'], // Accessible selon created_by
      badge: requestsStats.total_demandes || 0
    },
    {
      id: 'payments',
      name: 'Paiements',
      icon: '💳',
      description: 'Suivi des paiements',
      color: 'from-indigo-500 to-indigo-600',
      roles: ['admin', 'commercial', 'comptable']
    },
    {
      id: 'users', 
      name: 'Utilisateurs',
      icon: '⚙️',
      description: 'Gestion des utilisateurs système',
      color: 'from-red-500 to-red-600',
      roles: ['admin'] // Uniquement pour les admins
    },
    ...(isAdmin() ? [{
      id: 'system',
      name: 'Système',
      icon: '🔧',
      description: 'Configuration et maintenance',
      color: 'from-gray-500 to-gray-600',
      roles: ['admin']
    }] : [])
  ];

  // Filtrer les modules selon le rôle de l'utilisateur
  const availableModules = modules.filter(module => 
    module.roles.includes(user?.role)
  );

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

  const renderModuleContent = () => {
    switch(currentModule) {
      case 'overview':
        return <OverviewModule user={user} onNavigate={setCurrentModule} notifications={notifications} requestsStats={requestsStats} />;
      case 'clients':
        return <ClientsModule user={user} />;
      case 'invoices':
        return <InvoicesModule user={user} />;
      case 'requests':
        return <AdminRequestsModule user={user} />;
      case 'payments':
        return <PaymentsModule user={user} />;
      case 'users':
        return <UsersModule user={user} />;
      case 'system':
        return <SystemModule user={user} />;
      default:
        return <OverviewModule user={user} onNavigate={setCurrentModule} notifications={notifications} requestsStats={requestsStats} />;
    }
  };

  return (
    <div className="dashboard-professional">
      {/* Navigation latérale */}
      <div className={`sidebar ${sidebarExpanded ? 'expanded' : 'collapsed'}`}>
        <div className="sidebar-header">
          <div className="logo-section">
            <div className="logo-icon">🏨</div>
            {sidebarExpanded && (
              <div className="logo-text">
                <span className="logo-primary">Amani</span>
                <span className="logo-secondary">Gestion</span>
              </div>
            )}
          </div>
          
          <button 
            className="sidebar-toggle"
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
          >
            {sidebarExpanded ? '◀' : '▶'}
          </button>
        </div>

        <div className="user-profile">
          <div className="user-avatar">
            {user.prenom?.charAt(0)}{user.nom?.charAt(0)}
          </div>
          {sidebarExpanded && (
            <div className="user-info">
              <span className="user-name">{user.prenom} {user.nom}</span>
              <span className="user-role">{user.role?.toUpperCase()}</span>
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          {availableModules.map((module) => (
            <button
              key={module.id}
              className={`nav-item ${currentModule === module.id ? 'active' : ''}`}
              onClick={() => setCurrentModule(module.id)}
              title={!sidebarExpanded ? module.name : ''}
            >
              <span className="nav-icon">{module.icon}</span>
              {sidebarExpanded && (
                <div className="nav-content">
                  <span className="nav-name">{module.name}</span>
                  <span className="nav-description">{module.description}</span>
                </div>
              )}
              {/* Badge de notification pour les demandes */}
              {module.id === 'requests' && module.badge > 0 && (
                <div className="nav-badge">
                  <span className="badge-count">{module.badge}</span>
                </div>
              )}
              {currentModule === module.id && <div className="nav-indicator" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
            <span className="logout-icon">🚪</span>
            {sidebarExpanded && <span>Déconnexion</span>}
          </button>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="main-content">
        <div className="content-header">
          <div className="header-left">
            <h1 className="page-title">
              {availableModules.find(m => m.id === currentModule)?.name || 'Tableau de bord'}
            </h1>
            <div className="breadcrumb">
              <span>Amani</span>
              <span className="separator">•</span>
              <span>{availableModules.find(m => m.id === currentModule)?.name}</span>
            </div>
          </div>

          <div className="header-right">
            {/* Badge de notification */}
            <NotificationBadge
              unreadCount={unreadCount}
              notifications={notificationList}
              onMarkAsRead={markAsRead}
              onMarkAllAsRead={markAllAsRead}
              onDeleteNotification={deleteNotification}
              onOpenPanel={handleOpenNotificationPanel}
              isConnected={isConnected}
              userRole={user?.role}
            />

            {/* Informations utilisateur */}
            <div className="user-info-header">
              <span className="user-name-header">{user.prenom} {user.nom}</span>
              <span className="user-role-header">{user.role}</span>
            </div>
          </div>
        </div>

        <div className="content-body">
          {/* Afficher les erreurs de notification */}
          {notificationError && (
            <div className="notification-error">
              <span className="error-icon">⚠️</span>
              <span>Erreur notifications: {notificationError}</span>
            </div>
          )}

          {renderModuleContent()}
        </div>
      </div>

      {/* Panneau de notifications */}
      {showNotificationPanel && (
        <NotificationPanel
          notifications={notificationList}
          unreadCount={unreadCount}
          isConnected={isConnected}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
          onDeleteNotification={deleteNotification}
          onClearAllNotifications={clearAllNotifications}
          onLoadMore={() => loadNotifications(Math.ceil(notificationList.length / 20) + 1)}
          onClose={handleCloseNotificationPanel}
          userRole={user?.role}
        />
      )}
    </div>
  );
};

// Module Vue d'ensemble avec statistiques de notifications et demandes
const OverviewModule = ({ user, onNavigate, notifications, requestsStats }) => {
  const [stats, setStats] = useState({
    totalClients: 0,
    totalFactures: 0,
    totalUsers: 0,
    caRealise: 0,
    facturesEnRetard: 0
  });

  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchRecentActivity();
  }, [notifications]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      
      // Récupération des stats des clients
      const clientsResponse = await fetch('http://localhost:5000/api/clients/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (clientsResponse.ok) {
        const clientsData = await clientsResponse.json();
        setStats(prev => ({
          ...prev,
          totalClients: clientsData.data.total_clients
        }));
      }

      // Récupération des stats des factures
      const invoicesResponse = await fetch('http://localhost:5000/api/invoices/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (invoicesResponse.ok) {
        const invoicesData = await invoicesResponse.json();
        setStats(prev => ({
          ...prev,
          totalFactures: invoicesData.data.total_factures,
          caRealise: invoicesData.data.ca_realise,
          facturesEnRetard: invoicesData.data.en_retard
        }));
      }

      // Récupération des stats des utilisateurs (admin seulement)
      if (user?.role === 'admin') {
        const usersResponse = await fetch('http://localhost:5000/api/users/stats', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json'
          }
        });

        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          setStats(prev => ({
            ...prev,
            totalUsers: usersData.data.total_users
          }));
        }
      }

    } catch (error) {
      console.error('Erreur récupération stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentActivity = () => {
    // Utiliser les notifications récentes comme activité
    const recentNotifications = notifications.notifications?.slice(0, 5) || [];
    const activity = recentNotifications.map(notif => ({
      id: notif.id,
      action: notif.titre,
      description: notif.message,
      time: formatRelativeTime(notif.date_creation),
      icon: getActivityIcon(notif.type)
    }));

    setRecentActivity(activity);
  };

  const getActivityIcon = (type) => {
    const icons = {
      'facture_nouvelle': '📄',
      'paiement_recu': '💰',
      'client_nouveau': '👥',
      'demande_client': '📝',
      'modification_approuvee': '✅',
      'modification_rejetee': '❌',
      'mot_de_passe_approuve': '🔐',
      'system': '⚙️'
    };
    return icons[type] || '🔔';
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const quickActions = [
    {
      id: 'new-client',
      name: 'Nouveau client',
      icon: '👥',
      action: () => onNavigate('clients'),
      color: 'green',
      roles: ['admin', 'commercial', 'comptable']
    },
    {
      id: 'new-invoice',
      name: 'Créer une facture',
      icon: '📄',
      action: () => onNavigate('invoices'),
      color: 'blue',
      roles: ['admin', 'commercial', 'comptable']
    },
    {
      id: 'view-requests',
      name: 'Voir les demandes',
      icon: '📝',
      action: () => onNavigate('requests'),
      color: 'orange',
      roles: ['admin', 'commercial', 'comptable'],
      badge: requestsStats.total_demandes || 0
    },
    {
      id: 'record-payment',
      name: 'Enregistrer un paiement',
      icon: '💳',
      action: () => onNavigate('payments'),
      color: 'purple',
      roles: ['admin', 'commercial', 'comptable']
    },
    {
      id: 'new-user',
      name: 'Nouvel utilisateur',
      icon: '⚙️',
      action: () => onNavigate('users'),
      color: 'red',
      roles: ['admin'] // Uniquement pour les admins
    },
    {
      id: 'view-reports',
      name: 'Voir les rapports',
      icon: '📊',
      action: () => console.log('Rapports à venir'),
      color: 'indigo',
      roles: ['admin', 'commercial', 'comptable']
    }
  ];

  // Filtrer les actions selon le rôle
  const availableActions = quickActions.filter(action => 
    action.roles.includes(user?.role)
  );

  if (loading && (!stats.totalClients && !stats.totalFactures)) {
    return (
      <div className="overview-loading">
        <div className="loading-spinner"></div>
        <p>Chargement du tableau de bord...</p>
      </div>
    );
  }

  return (
    <div className="overview-module">
      {/* Statistiques avec notifications */}
      <div className="stats-grid">
        <div className="stat-card blue">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3 className="stat-value">{stats.totalClients}</h3>
            <p className="stat-label">Clients actifs</p>
          </div>
        </div>

        <div className="stat-card green">
          <div className="stat-icon">📄</div>
          <div className="stat-content">
            <h3 className="stat-value">{stats.totalFactures}</h3>
            <p className="stat-label">Factures créées</p>
          </div>
        </div>

        <div className="stat-card purple">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <h3 className="stat-value">{formatCurrency(stats.caRealise)}</h3>
            <p className="stat-label">CA réalisé</p>
          </div>
        </div>

        {/* Carte demandes clients */}
        <div className="stat-card orange">
          <div className="stat-icon">📝</div>
          <div className="stat-content">
            <h3 className="stat-value">{requestsStats.total_demandes || 0}</h3>
            <p className="stat-label">Demandes en attente</p>
          </div>
          {requestsStats.total_demandes > 0 && (
            <div className="stat-badge">
              <span className="badge-urgent">Urgent</span>
            </div>
          )}
        </div>

        {/* Carte notifications */}
        <div className="stat-card blue">
          <div className="stat-icon">🔔</div>
          <div className="stat-content">
            <h3 className="stat-value">{notifications.unreadCount || 0}</h3>
            <p className="stat-label">Notifications non lues</p>
          </div>
          <div className="stat-badge">
            {notifications.isConnected ? (
              <span className="badge-connected">En ligne</span>
            ) : (
              <span className="badge-disconnected">Hors ligne</span>
            )}
          </div>
        </div>

        {/* Stat utilisateurs visible uniquement pour les admins */}
        {user?.role === 'admin' && (
          <div className="stat-card red">
            <div className="stat-icon">⚙️</div>
            <div className="stat-content">
              <h3 className="stat-value">{stats.totalUsers}</h3>
              <p className="stat-label">Utilisateurs système</p>
            </div>
          </div>
        )}
      </div>

      <div className="quick-actions">
        <h2>Actions rapides</h2>
        <div className="action-cards">
          {availableActions.map((action) => (
            <button 
              key={action.id}
              className={`action-card ${action.color}`}
              onClick={action.action}
            >
              <span className="action-icon">{action.icon}</span>
              <span>{action.name}</span>
              {action.badge > 0 && (
                <div className="action-badge">
                  {action.badge}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="recent-activity">
        <h2>Activité récente</h2>
        <div className="activity-list">
          {recentActivity.length > 0 ? (
            recentActivity.map((item) => (
              <div key={item.id} className="activity-item">
                <div className="activity-icon">{item.icon}</div>
                <div className="activity-content">
                  <p><strong>{item.action}:</strong> {item.description}</p>
                  <span className="activity-time">{item.time}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="no-activity">
              <span className="empty-icon">📭</span>
              <p>Aucune activité récente</p>
            </div>
          )}
        </div>
      </div>

      {/* Section statistiques détaillées des demandes si admin */}
      {user?.role === 'admin' && requestsStats.total_demandes > 0 && (
        <div className="requests-summary">
          <h2>Résumé des demandes</h2>
          <div className="requests-breakdown">
            <div className="breakdown-item">
              <span className="breakdown-icon">👤</span>
              <span className="breakdown-label">Modifications profil</span>
              <span className="breakdown-value">{requestsStats.demandes_profil || 0}</span>
            </div>
            <div className="breakdown-item">
              <span className="breakdown-icon">🔐</span>
              <span className="breakdown-label">Changements mot de passe</span>
              <span className="breakdown-value">{requestsStats.demandes_mot_de_passe || 0}</span>
            </div>
          </div>
          <button 
            className="view-all-requests-btn"
            onClick={() => onNavigate('requests')}
          >
            Voir toutes les demandes →
          </button>
        </div>
      )}
    </div>
  );
};

// Modules temporaires
const PaymentsModule = ({ user }) => (
  <div className="module-placeholder">
    <h2>Module Paiements</h2>
    <p>Interface de gestion des paiements en cours de développement...</p>
    <div className="coming-soon-badge">
      <span className="badge-icon">🚀</span>
      <span>Prochainement disponible</span>
    </div>
  </div>
);

const SystemModule = ({ user }) => (
  <div className="module-placeholder">
    <h2>Module Système</h2>
    <p>Configuration et maintenance du système en cours de développement...</p>
    <div className="coming-soon-badge">
      <span className="badge-icon">🚀</span>
      <span>Prochainement disponible</span>
    </div>
  </div>
);

export default DashboardProfessional;