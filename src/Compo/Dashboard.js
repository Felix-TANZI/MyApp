import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Dashboard.css';

const Dashboard = ({ onNavigate }) => {
  const { user, userType, logout, isAdmin, isCommercial, isComptable, isClient } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      console.log('Déconnexion réussie');
    } catch (error) {
      console.error('Erreur déconnexion:', error);
    }
  };

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <div className="logo-section">
              <span className="logo-icon">🏨</span>
              <span className="logo-text">Hilton Yaoundé</span>
            </div>
            <div className="page-title">
              {userType === 'professional' ? 'Tableau de bord professionnel' : 'Espace client'}
            </div>
          </div>
          
          <div className="header-right">
            <div className="user-info">
              <div className="user-avatar">
                {userType === 'professional' ? '👨‍💼' : '👤'}
              </div>
              <div className="user-details">
                <div className="user-name">
                  {user?.nom} {user?.prenom}
                </div>
                <div className="user-role">
                  {userType === 'professional' ? user?.role?.toUpperCase() : 'CLIENT'}
                </div>
              </div>
            </div>
            
            <button className="logout-btn" onClick={handleLogout}>
              <span>🚪</span>
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-container">
          <div className="welcome-section">
            <h1>Bienvenue {user?.prenom} !</h1>
            <p>Connexion réussie au système Hilton Yaoundé</p>
          </div>

          <div className="info-cards">
            <div className="info-card">
              <div className="card-icon">✅</div>
              <div className="card-content">
                <h3>Statut</h3>
                <p>Connecté avec succès</p>
              </div>
            </div>

            <div className="info-card">
              <div className="card-icon">🔐</div>
              <div className="card-content">
                <h3>Type d'utilisateur</h3>
                <p>{userType === 'professional' ? 'Personnel Hilton' : 'Client'}</p>
              </div>
            </div>

            {userType === 'professional' && (
              <div className="info-card">
                <div className="card-icon">🎭</div>
                <div className="card-content">
                  <h3>Rôle</h3>
                  <p>{user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}</p>
                </div>
              </div>
            )}

            {userType === 'client' && (
              <div className="info-card">
                <div className="card-icon">🆔</div>
                <div className="card-content">
                  <h3>Code client</h3>
                  <p>{user?.code_client}</p>
                </div>
              </div>
            )}
          </div>

          <div className="development-notice">
            <h3>🚧 En développement</h3>
            <p>Cette interface sera enrichie avec les fonctionnalités de gestion des factures.</p>
            <p>Notre equipe y travaille !</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;