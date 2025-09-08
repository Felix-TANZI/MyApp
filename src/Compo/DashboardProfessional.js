import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ClientsModule from './ClientsModule';
import InvoicesModule from './InvoicesModule';
import UsersModule from './UsersModule';
import './DashboardProfessional.css';

const DashboardProfessional = () => {
  const { user, logout, isAdmin } = useAuth();
  const [currentModule, setCurrentModule] = useState('overview');
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  // Modules disponibles selon le rôle
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
      id: 'payments',
      name: 'Paiements',
      icon: '💳',
      description: 'Suivi des paiements',
      color: 'from-orange-500 to-orange-600',
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

  const renderModuleContent = () => {
    switch(currentModule) {
      case 'overview':
        return <OverviewModule user={user} onNavigate={setCurrentModule} />;
      case 'clients':
        return <ClientsModule user={user} />;
      case 'invoices':
        return <InvoicesModule user={user} />;
      case 'payments':
        return <PaymentsModule user={user} />;
      case 'users':
        return <UsersModule user={user} />;
      case 'system':
        return <SystemModule user={user} />;
      default:
        return <OverviewModule user={user} onNavigate={setCurrentModule} />;
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
          <h1 className="page-title">
            {availableModules.find(m => m.id === currentModule)?.name || 'Tableau de bord'}
          </h1>
          <div className="breadcrumb">
            <span>Amani</span>
            <span className="separator">•</span>
            <span>{availableModules.find(m => m.id === currentModule)?.name}</span>
          </div>
        </div>

        <div className="content-body">
          {renderModuleContent()}
        </div>
      </div>
    </div>
  );
};

// Module Vue d'ensemble avec actions rapides avec accès conditionnel
const OverviewModule = ({ user, onNavigate }) => {
  const [stats, setStats] = useState({
    totalClients: 0,
    totalFactures: 0,
    totalUsers: 0,
    caRealise: 0,
    facturesEnRetard: 0
  });

  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    fetchStats();
    fetchRecentActivity();
  }, []);

  const fetchStats = async () => {
    try {
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

      //  Récupération des stats des utilisateurs, uniquement l'administrateur
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
    }
  };

  const fetchRecentActivity = async () => {
    // Simulation de l'activité récente pour l'instant
    setRecentActivity([
      {
        id: 1,
        action: 'Facture créée',
        description: 'Facture HILT-2025-001 pour CAMTEL SA',
        time: 'Il y a 1 heure',
        icon: '📄'
      },
      {
        id: 2,
        action: 'Client créé',
        description: 'Nouveau client Orange Cameroun ajouté',
        time: 'Il y a 2 heures',
        icon: '👥'
      },
      {
        id: 3,
        action: 'Paiement reçu',
        description: 'Paiement facture HILT-2024-089',
        time: 'Il y a 4 heures',
        icon: '💳'
      },
      ...(user?.role === 'admin' ? [{
        id: 4,
        action: 'Utilisateur créé',
        description: 'Nouvel utilisateur commercial ajouté',
        time: 'Il y a 6 heures',
        icon: '⚙️'
      }] : [])
    ]);
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
      action: () => console.log('Rapports'),
      color: 'orange',
      roles: ['admin', 'commercial', 'comptable']
    }
  ];

  // Filtrer les actions selon le rôle
  const availableActions = quickActions.filter(action => 
    action.roles.includes(user?.role)
  );

  return (
    <div className="overview-module">
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

        {/* ✅ Stat utilisateurs visible uniquement pour les admins */}
        {user?.role === 'admin' ? (
          <div className="stat-card red">
            <div className="stat-icon">⚙️</div>
            <div className="stat-content">
              <h3 className="stat-value">{stats.totalUsers}</h3>
              <p className="stat-label">Utilisateurs système</p>
            </div>
          </div>
        ) : (
          <div className="stat-card orange">
            <div className="stat-icon">⚠️</div>
            <div className="stat-content">
              <h3 className="stat-value">{stats.facturesEnRetard}</h3>
              <p className="stat-label">Factures en retard</p>
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
            </button>
          ))}
        </div>
      </div>

      <div className="recent-activity">
        <h2>Activité récente</h2>
        <div className="activity-list">
          {recentActivity.map((item) => (
            <div key={item.id} className="activity-item">
              <div className="activity-icon">{item.icon}</div>
              <div className="activity-content">
                <p><strong>{item.action}:</strong> {item.description}</p>
                <span className="activity-time">{item.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
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