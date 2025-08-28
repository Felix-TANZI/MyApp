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
    // Nous allons allons implanter le logique de connexion plus tard
    console.log('Professional Login:', formData);
  };

  const handleForgotPassword = () => {
    setShowAdminMessage(true);
  };

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Panneau gauche */}
        <div className="login-left">
          <div className="animated-background"></div>
          <div className="welcome-content">
            <div className="auth-icon">
              🔐
            </div>
            <h1 className="welcome-title">Bienvenue</h1>
            <p className="welcome-subtitle">
              Accédez à votre espace professionnel pour gérer les factures clients
            </p>
          </div>
        </div>

        {/* Panneau droite */}
        <div className="login-right">
          <div className="form-header">
            <h2 className="form-title">Espace Professionnel</h2>
            <p className="form-subtitle">Connectez-vous à votre compte</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="identifier" className="form-label">
                Identifiant
              </label>
              <input
                type="text"
                id="identifier"
                name="identifier"
                className="form-input"
                placeholder="Pseudo, email professionnel ou matricule"
                value={formData.identifier}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Mot de passe
              </label>
              <input
                type="password"
                id="password"
                name="password"
                className="form-input"
                placeholder="Entrez votre mot de passe"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            <div className="checkbox-group">
              <input
                type="checkbox"
                id="rememberMe"
                name="rememberMe"
                checked={formData.rememberMe}
                onChange={handleChange}
              />
              <label htmlFor="rememberMe" className="checkbox-label">
                Se souvenir de moi
              </label>
            </div>

            <button type="submit" className="btn-primary">
              SE CONNECTER
            </button>

            <div className="forgot-password">
              <button 
                type="button" 
                className="forgot-link"
                onClick={handleForgotPassword}
              >
                Mot de passe oublié ?
              </button>
            </div>

            {showAdminMessage && (
              <div className="admin-message">
                <strong>Information :</strong> Pour réinitialiser votre mot de passe, 
                veuillez contacter l'administrateur système à l'adresse : 
                <strong> admin@hilton.com</strong>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default LogPro;