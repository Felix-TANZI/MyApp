import React from 'react';
import './HomePage.css';

const HomePage = ({ onNavigate }) => {
  return (
    <div className="home-page">
      {/* Header avec logo et navigation */}
      <header className="home-header">
        <div className="header-container">
          <div className="logo-section">
            <div className="amani-logo">
              <div className="logo-icon">🏨</div>
              <div className="logo-text">
                <span className="logo-primary">AMANI</span>
                <span className="logo-secondary">Gestion Hôtelière</span>
              </div>
            </div>
          </div>
          <nav className="header-nav">
            <div className="nav-info">Système de Gestion des Factures</div>
          </nav>
        </div>
      </header>

      {/* Section Hero */}
      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-badge">
              <span className="badge-icon">✨</span>
              Solution de Gestion Hôtelière
            </div>
            <h1 className="hero-title">
              Bienvenue sur 
              <span className="title-highlight"> Amani</span>
            </h1>
            <p className="hero-subtitle">
              Votre solution complète de gestion de factures pour établissements hôteliers. 
              Accédez à votre espace sécurisé pour la gestion de vos factures et services.
            </p>
            
            <div className="hero-stats">
              <div className="stat-item">
                <div className="stat-number">100%</div>
                <div className="stat-label">Sécurisé</div>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <div className="stat-number">24/7</div>
                <div className="stat-label">Disponibilité</div>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <div className="stat-number">Multi</div>
                <div className="stat-label">Établissements</div>
              </div>
            </div>
          </div>
          
          <div className="hero-visual">
            <div className="visual-card main-card">
              <div className="card-glow"></div>
              <img 
                src="/image/auth.png"
                alt="Amani - Système sécurisé de gestion hôtelière" 
                className="hero-image"
              />
            </div>
            <div className="floating-elements">
              <div className="float-element element-1">🔐</div>
              <div className="float-element element-2">📊</div>
              <div className="float-element element-3">💼</div>
            </div>
          </div>
        </div>
      </section>

      {/* Section Connexion */}
      <section className="connection-section">
        <div className="section-container">
          <div className="section-header">
            <h2 className="section-title">Accéder à votre espace</h2>
            <p className="section-subtitle">
              Choisissez votre profil pour accéder à vos services personnalisés
            </p>
          </div>

          <div className="connection-cards">
            {/* Carte Professionnelle */}
            <div className="connection-card pro-card">
              <div className="card-header">
                <div className="card-icon pro-icon">
                  <span className="icon-symbol">🏢</span>
                </div>
                <div className="card-badge pro-badge">Personnel</div>
              </div>
              
              <div className="card-content">
                <h3 className="card-title">Espace Professionnel</h3>
                <p className="card-description">
                  Accès réservé au personnel hôtelier : administrateurs, 
                  équipe commerciale et service comptabilité.
                </p>
              </div>
              
              <button 
                className="card-button pro-button"
                onClick={() => onNavigate('professional')}
              >
                <span className="button-text">Connexion Professionnelle</span>
                <span className="button-arrow">→</span>
              </button>
            </div>

            {/* Carte Client */}
            <div className="connection-card client-card">
              <div className="card-header">
                <div className="card-icon client-icon">
                  <span className="icon-symbol">👤</span>
                </div>
                <div className="card-badge client-badge">Client</div>
              </div>
              
              <div className="card-content">
                <h3 className="card-title">Espace Client</h3>
                <p className="card-description">
                  Consultez et gérez vos factures
                  en toute simplicité et sécurité.
                </p>
              </div>
              
              <button 
                className="card-button client-button"
                onClick={() => onNavigate('client')}
              >
                <span className="button-text">Connexion Client</span>
                <span className="button-arrow">→</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <div className="footer-container">
          <div className="footer-content">
            <div className="footer-brand">
              <div className="footer-logo">
                <span className="footer-logo-icon">🏨</span>
                <span className="footer-logo-text">Amani</span>
              </div>
              <p className="footer-description">
                Solution de gestion hôtelière moderne et sécurisée, développée au Cameroun pour l'excellence dans l'hospitalité.
              </p>
            </div>
            
            <div className="footer-info">
              <div className="info-section">
                <h4 className="info-title">Application</h4>
                <div className="info-items">
                  <div className="info-item">🌐 Application Web</div>
                  <div className="info-item">🔒 Sécurisée SSL</div>
                  <div className="info-item">📱 Interface Responsive</div>
                </div>
              </div>
              
              <div className="info-section">
                <h4 className="info-title">Équipe Technique</h4>
                <div className="info-items">
                  <div className="info-item">📧 tanzifelix@gmail.com</div>
                  <div className="info-item">📧 taoussetmounira@gmail.com</div>
                </div>
              </div>

              <div className="info-section">
                <h4 className="info-title">Superviseurs</h4>
                <div className="info-items">
                  <div className="info-item">Ing Francis OBONO</div>
                  <div className="info-item">Ing Ramses FOUDA</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="footer-bottom">
            <div className="footer-copyright">
              © 2025 Amani - Système de Gestion Hôtelière. Développé au Cameroun.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;