import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './LogPro.css';

const LogPro = ({ onNavigate }) => {
  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
    rememberMe: false
  });
  const [showAdminMessage, setShowAdminMessage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { loginProfessional, error, clearError, loading } = useAuth();

  // Effacer les erreurs au changement de champ
  useEffect(() => {
    if (error) {
      clearError();
    }
  }, [formData.identifier, formData.password]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await loginProfessional({
        identifier: formData.identifier,
        password: formData.password,
        rememberMe: formData.rememberMe
      });

      if (result.success) {
        console.log('Connexion professionnelle réussie');
        // La redirection sera gérée automatiquement par le contexte d'auth
      }
    } catch (error) {
      console.error('Erreur lors de la connexion:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = () => {
    setShowAdminMessage(true);
  };

  return (
    <div className="login-page">
      <div className="login-container-full">
        {/* Bouton retour */}
        <button className="back-button-pro" onClick={() => onNavigate('home')}>
          <span className="back-arrow">←</span>
          <span className="back-text">Retour à l'accueil</span>
        </button>

        {/* Panneau gauche - Image complète */}
        <div className="login-left-image">
          <div className="image-overlay">
            <img 
              src="/image/auth.png" 
              alt="Illustration de sécurité - Gestion d'accès"
              className="main-illustration"
            />
          </div>
        </div>

        {/* Panneau droite - Formulaire adapté */}
        <div className="login-right-adapted">
          <div className="form-header-adapted">
            <div className="hilton-brand">
              <h2 className="form-title-adapted">Amani Pro</h2>
              <div className="brand-line"></div>
            </div>
            <p className="form-subtitle-adapted">Administration • Commercial • Comptabilité</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form-adapted">
            {/* Affichage des erreurs */}
            {error && (
              <div className="error-message-pro">
                <div className="error-icon">⚠️</div>
                <div className="error-text">{error}</div>
              </div>
            )}

            <div className="form-group-adapted">
              <label htmlFor="identifier" className="form-label-adapted">
                <span className="label-icon">🏢</span>
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
                disabled={isSubmitting || loading}
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
                disabled={isSubmitting || loading}
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
                disabled={isSubmitting || loading}
              />
              <label htmlFor="rememberMe" className="checkbox-label-adapted">
                Se souvenir de moi
              </label>
            </div>

            <button 
              type="submit" 
              className="btn-primary-adapted"
              disabled={isSubmitting || loading}
            >
              {isSubmitting || loading ? (
                <>
                  <span className="btn-icon">⏳</span>
                  CONNEXION...
                </>
              ) : (
                <>
                  <span className="btn-icon"></span>
                  Se connecter
                </>
              )}
            </button>

            <div className="forgot-password-adapted">
              <button 
                type="button" 
                className="forgot-link-adapted"
                onClick={handleForgotPassword}
                disabled={isSubmitting || loading}
              >
                Problème d'accès ?
              </button>
            </div>

            {showAdminMessage && (
              <div className="admin-message-adapted">
                <div className="message-icon">ℹ️</div>
                <div className="message-content">
                  <strong>Support Technique Amani</strong>
                  <p>Contactez l'administrateur système :</p>
                  <strong>tanzifelix@gmail.com</strong>
                </div>
              </div>
            )}
          </form>

        </div>
      </div>
    </div>
  );
};

export default LogPro;