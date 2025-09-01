import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
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
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 'clients',
      name: 'Clients',
      icon: '👥',
      description: 'Gestion des clients',
      color: 'from-green-500 to-green-600'
    },
    {
      id: 'invoices',
      name: 'Factures',
      icon: '📄',
      description: 'Création et gestion des factures',
      color: 'from-purple-500 to-purple-600'
    },
    {
      id: 'payments',
      name: 'Paiements',
      icon: '💳',
      description: 'Suivi des paiements',
      color: 'from-orange-500 to-orange-600'
    },
    ...(isAdmin() ? [{
      id: 'admin',
      name: 'Administration',
      icon: '⚙️',
      description: 'Gestion des utilisateurs',
      color: 'from-red-500 to-red-600'
    }] : [])
  ];

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
        return <OverviewModule user={user} />;
      case 'clients':
        return <ClientsModule user={user} />;
      case 'invoices':
        return <InvoicesModule user={user} />;
      case 'payments':
        return <PaymentsModule user={user} />;
      case 'admin':
        return <AdminModule user={user} />;
      default:
        return <OverviewModule user={user} />;
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
                <span className="logo-primary">Hilton</span>
                <span className="logo-secondary">Yaoundé</span>
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
          {modules.map((module) => (
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
            {modules.find(m => m.id === currentModule)?.name || 'Tableau de bord'}
          </h1>
          <div className="breadcrumb">
            <span>Hilton Yaoundé</span>
            <span className="separator">•</span>
            <span>{modules.find(m => m.id === currentModule)?.name}</span>
          </div>
        </div>

        <div className="content-body">
          {renderModuleContent()}
        </div>
      </div>
    </div>
  );
};

// Module Vue d'ensemble
const OverviewModule = ({ user }) => {
  const [stats, setStats] = useState({
    totalClients: 0,
    totalFactures: 0,
    caRealise: 0,
    facturesEnRetard: 0
  });

  useEffect(() => {
    // Par la suite nous allons Appeler une API pour récupérer les statistiques
    fetchStats();
  }, []);

  const fetchStats = async () => {
    // Pour l'instant on se contentera de Simuler les données
    setStats({
      totalClients: 25,
      totalFactures: 142,
      caRealise: 12750000,
      facturesEnRetard: 3
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

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

        <div className="stat-card orange">
          <div className="stat-icon">⚠️</div>
          <div className="stat-content">
            <h3 className="stat-value">{stats.facturesEnRetard}</h3>
            <p className="stat-label">Factures en retard</p>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <h2>Actions rapides</h2>
        <div className="action-cards">
          <button className="action-card">
            <span className="action-icon">➕</span>
            <span>Nouveau client</span>
          </button>
          <button className="action-card">
            <span className="action-icon">📄</span>
            <span>Créer une facture</span>
          </button>
          <button className="action-card">
            <span className="action-icon">💳</span>
            <span>Enregistrer un paiement</span>
          </button>
        </div>
      </div>

      <div className="recent-activity">
        <h2>Activité récente</h2>
        <div className="activity-list">
          <div className="activity-item">
            <div className="activity-icon">📄</div>
            <div className="activity-content">
              <p>Facture HILT-2025-001 créée pour CAMTEL SA</p>
              <span className="activity-time">Il y a 2 heures</span>
            </div>
          </div>
          <div className="activity-item">
            <div className="activity-icon">💳</div>
            <div className="activity-content">
              <p>Paiement reçu - Facture HILT-2025-002</p>
              <span className="activity-time">Il y a 4 heures</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Modules temporaires, nous le développeront par la suite
const ClientsModule = ({ user }) => (
  <div className="module-placeholder">
    <h2>Module Clients</h2>
    <p>Interface de gestion des clients en cours de développement...</p>
  </div>
);

const InvoicesModule = ({ user }) => (
  <div className="module-placeholder">
    <h2>Module Factures</h2>
    <p>Interface de gestion des factures en cours de développement...</p>
  </div>
);

const PaymentsModule = ({ user }) => (
  <div className="module-placeholder">
    <h2>Module Paiements</h2>
    <p>Interface de gestion des paiements en cours de développement...</p>
  </div>
);

const AdminModule = ({ user }) => (
  <div className="module-placeholder">
    <h2>Module Administration</h2>
    <p>Interface d'administration en cours de développement...</p>
  </div>
);

export default DashboardProfessional;