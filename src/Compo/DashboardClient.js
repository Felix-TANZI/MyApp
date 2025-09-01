import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './DashboardClient.css';

const DashboardClient = () => {
  const { user, logout } = useAuth();
  const [factures, setFactures] = useState([]);
  const [stats, setStats] = useState({
    totalFactures: 0,
    montantTotal: 0,
    facturesPayees: 0,
    facturesEnAttente: 0
  });

  useEffect(() => {
    fetchClientData();
  }, []);

  const fetchClientData = async () => {
    // Par la suite nous allons continuer avec API mais pour le moment on se limite a une Simulation des données client
    const mockFactures = [
      {
        id: 1,
        numero: 'HILT-2024-001',
        date: '2024-12-01',
        montant: 178875,
        statut: 'payee',
        type: 'Hébergement'
      },
      {
        id: 2,
        numero: 'HILT-2024-015',
        date: '2024-12-15',
        montant: 89437,
        statut: 'envoyee',
        type: 'Restauration'
      }
    ];
    
    setFactures(mockFactures);
    
    setStats({
      totalFactures: mockFactures.length,
      montantTotal: mockFactures.reduce((sum, f) => sum + f.montant, 0),
      facturesPayees: mockFactures.filter(f => f.statut === 'payee').length,
      facturesEnAttente: mockFactures.filter(f => f.statut === 'envoyee').length
    });
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Erreur déconnexion:', error);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatutBadge = (statut) => {
    const badges = {
      'payee': { class: 'success', text: 'Payée' },
      'envoyee': { class: 'warning', text: 'En attente' },
      'en_retard': { class: 'danger', text: 'En retard' },
      'brouillon': { class: 'draft', text: 'Brouillon' }
    };
    
    return badges[statut] || { class: 'default', text: statut };
  };

  return (
    <div className="dashboard-client">
      {/* Header */}
      <header className="client-header">
        <div className="header-content">
          <div className="header-left">
            <div className="logo-section">
              <span className="logo-icon">🏨</span>
              <span className="logo-text">Hilton Yaoundé</span>
            </div>
            <div className="page-title">Espace Client</div>
          </div>
          
          <div className="header-right">
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
          <div className="welcome-section">
            <h1>Bonjour {user?.prenom} !</h1>
            <p>Consultez et gérez vos factures Hilton Yaoundé</p>
          </div>

          {/* Statistiques */}
          <div className="client-stats">
            <div className="stat-card">
              <div className="stat-icon blue">📄</div>
              <div className="stat-content">
                <h3>{stats.totalFactures}</h3>
                <p>Factures totales</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon green">💰</div>
              <div className="stat-content">
                <h3>{formatCurrency(stats.montantTotal)}</h3>
                <p>Montant total</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon success">✅</div>
              <div className="stat-content">
                <h3>{stats.facturesPayees}</h3>
                <p>Factures payées</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon warning">⏳</div>
              <div className="stat-content">
                <h3>{stats.facturesEnAttente}</h3>
                <p>En attente</p>
              </div>
            </div>
          </div>

          {/* Liste des factures */}
          <div className="factures-section">
            <div className="section-header">
              <h2>Mes factures</h2>
              <div className="section-actions">
                <button className="btn-secondary">
                  <span>📊</span>
                  Voir tout
                </button>
              </div>
            </div>

            <div className="factures-list">
              {factures.length > 0 ? (
                factures.map((facture) => (
                  <div key={facture.id} className="facture-card">
                    <div className="facture-info">
                      <div className="facture-header">
                        <h3 className="facture-numero">{facture.numero}</h3>
                        <span className={`statut-badge ${getStatutBadge(facture.statut).class}`}>
                          {getStatutBadge(facture.statut).text}
                        </span>
                      </div>
                      <div className="facture-details">
                        <span className="facture-type">{facture.type}</span>
                        <span className="facture-date">{new Date(facture.date).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>
                    <div className="facture-amount">
                      <span className="amount">{formatCurrency(facture.montant)}</span>
                    </div>
                    <div className="facture-actions">
                      <button className="btn-view">
                        <span>👁️</span>
                        Voir
                      </button>
                      <button className="btn-download">
                        <span>📄</span>
                        PDF
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">📄</div>
                  <h3>Aucune facture</h3>
                  <p>Vous n'avez pas encore de factures.</p>
                </div>
              )}
            </div>
          </div>

          {/* Informations de contact */}
          <div className="contact-section">
            <h2>Besoin d'aide ?</h2>
            <div className="contact-cards">
              <div className="contact-card">
                <span className="contact-icon">📞</span>
                <div>
                  <h4>Téléphone</h4>
                  <p>+237 222 XXX XXX</p>
                </div>
              </div>
              <div className="contact-card">
                <span className="contact-icon">✉️</span>
                <div>
                  <h4>Email</h4>
                  <p>contact@hilton-yaounde.com</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardClient;