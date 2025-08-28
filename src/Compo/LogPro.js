import React, { useState } from 'react';
import './LogPro.css';

const LogPro = () => {
  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
    rememberMe: false
  });
  const [showAdminMessage, setShowAdminMessage] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Nous allons implanter la logique de connexion plus tard
    console.log('Professional Login:', formData);
  };

  const handleForgotPassword = () => {
    setShowAdminMessage(true);
  };

  return (
    <div className="login-page">
      <div className="login-container-full">
        {/* Panneau gauche - Image complète */}
        <div className="login-left-image">
          <div className="image-overlay">
            <img 
              src="/image/auth.png" 
              alt="Illustration de sécurité - Gestion d'accès"
              className="main-illustration"
            />
            <div className="overlay-content">
              <h1 className="welcome-title-overlay">Hilton Yaoundé</h1>
              <p className="welcome-subtitle-overlay">
                Système de gestion sécurisé des factures clients
              </p>
            </div>
          </div>
        </div>

        {/* Panneau droite - Formulaire adapté */}
        <div className="login-right-adapted">
          <div className="form-header-adapted">
            <div className="hilton-brand">
              <h2 className="form-title-adapted">Espace Professionnel</h2>
              <div className="brand-line"></div>
            </div>
            <p className="form-subtitle-adapted">Administration • Commercial • Comptabilité</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form-adapted">
            <div className="form-group-adapted">
              <label htmlFor="identifier" className="form-label-adapted">
                <span className="label-icon">👤</span>
                Identifiant
              </label>
              <input
                type="text"
                id="identifier"
                name="identifier"
                className="form-input-adapted"
                placeholder="Pseudo, email ou matricule"
                value={formData.identifier}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group-adapted">
              <label htmlFor="password" className="form-label-adapted">
                <span className="label-icon">🔒</span>
                Mot de passe
              </label>
              <input
                type="password"
                id="password"
                name="password"
                className="form-input-adapted"
                placeholder="Votre mot de passe sécurisé"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            <div className="checkbox-group-adapted">
              <input
                type="checkbox"
                id="rememberMe"
                name="rememberMe"
                checked={formData.rememberMe}
                onChange={handleChange}
              />
              <label htmlFor="rememberMe" className="checkbox-label-adapted">
                Maintenir la session active
              </label>
            </div>

            <button type="submit" className="btn-primary-adapted">
              <span className="btn-icon">🔐</span>
              ACCÉDER AU SYSTÈME
            </button>

            <div className="forgot-password-adapted">
              <button 
                type="button" 
                className="forgot-link-adapted"
                onClick={handleForgotPassword}
              >
                Problème d'accès ?
              </button>
            </div>

            {showAdminMessage && (
              <div className="admin-message-adapted">
                <div className="message-icon">ℹ️</div>
                <div className="message-content">
                  <strong>Support Technique</strong>
                  <p>Contactez l'administrateur système :</p>
                  <strong>admin@hilton-yaounde.com</strong>
                </div>
              </div>
            )}
          </form>

          <div className="footer-branding">
            <p>Hilton Yaoundé - Système sécurisé</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogPro;