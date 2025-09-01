import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './LogClient.css';

const LogClient = ({ onNavigate }) => {
  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
    rememberMe: false
  });
  const [showForgotForm, setShowForgotForm] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { loginClient, error, clearError, loading } = useAuth();

  // Effacer les erreurs au changement de champ
  useEffect(() => {
    if (error) {
      clearError();
    }
  }, [formData.identifier, formData.password, clearError]);

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
      const result = await loginClient({
        identifier: formData.identifier,
        password: formData.password,
        rememberMe: formData.rememberMe
      });

      if (result.success) {
        console.log('Connexion client réussie');
        // La redirection sera gérée automatiquement par le contexte d'auth
      }
    } catch (error) {
      console.error('Erreur lors de la connexion client:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = () => {
    // TODO: Implementer la logique de connexion Google
    console.log('Google Login initiated');
  };

  const handleForgotPassword = () => {
    setShowForgotForm(true);
  };

  const handleResetSubmit = (e) => {
    e.preventDefault();
    // TODO: Logique de réinitialisation à implémenter
    console.log('Reset password for:', resetEmail);
    setResetSent(true);
    
    // Simuler l'envoi et revenir au formulaire après 3 secondes
    setTimeout(() => {
      setShowForgotForm(false);
      setResetSent(false);
      setResetEmail('');
    }, 3000);
  };

  return (
    <div className="client-login-page">
      <div className="login-container-full-client">
        {/* Bouton retour */}
        <button className="back-button-client" onClick={() => onNavigate('home')}>
          <span className="back-arrow">←</span>
          <span className="back-text">Retour à l'accueil</span>
        </button>

        {/* Panneau gauche - Image */}
        <div className="login-left-image-client">
          <div className="image-overlay-client">
            <img 
              src="/image/auth.png" 
              alt="Illustration de sécurité - Espace Client"
              className="main-illustration-client"
            />
          </div>
        </div>

        {/* Panneau droite - Formulaire */}
        <div className="login-right-adapted-client">
          {!showForgotForm ? (
            // Formulaire de connexion principal
            <>
              <div className="form-header-adapted-client">
                <div className="hilton-brand-client">
                  <h2 className="form-title-adapted-client">Connexion Client</h2>
                  <div className="brand-line-client"></div>
                </div>
                <p className="form-subtitle-adapted-client">Accédez à votre espace personnel</p>
              </div>

              <form onSubmit={handleSubmit} className="login-form-adapted-client">
                {/* Affichage des erreurs */}
                {error && (
                  <div className="error-message-client">
                    <div className="error-icon">⚠️</div>
                    <div className="error-text">{error}</div>
                  </div>
                )}

                <div className="form-group-adapted-client">
                  <label htmlFor="identifier" className="form-label-adapted-client">
                    <span className="label-icon-client">🆔</span>
                    Code client ou Email
                  </label>
                  <input
                    type="text"
                    id="identifier"
                    name="identifier"
                    className="form-input-adapted-client"
                    placeholder="Votre code client ou adresse email"
                    value={formData.identifier}
                    onChange={handleChange}
                    disabled={isSubmitting || loading}
                    required
                  />
                </div>

                <div className="form-group-adapted-client">
                  <label htmlFor="password" className="form-label-adapted-client">
                    <span className="label-icon-client">🔐</span>
                    Mot de passe
                  </label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    className="form-input-adapted-client"
                    placeholder="Votre mot de passe"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={isSubmitting || loading}
                    required
                  />
                </div>

                <div className="checkbox-group-adapted-client">
                  <input
                    type="checkbox"
                    id="rememberMe"
                    name="rememberMe"
                    checked={formData.rememberMe}
                    onChange={handleChange}
                    disabled={isSubmitting || loading}
                  />
                  <label htmlFor="rememberMe" className="checkbox-label-adapted-client">
                    Se souvenir de moi
                  </label>
                </div>

                <button 
                  type="submit" 
                  className="btn-primary-adapted-client"
                  disabled={isSubmitting || loading}
                >
                  {isSubmitting || loading ? (
                    <>
                      <span className="btn-icon-client">⏳</span>
                      CONNEXION...
                    </>
                  ) : (
                    <>
                      <span className="btn-icon-client"></span>
                      Se Connecter
                    </>
                  )}
                </button>

                <div className="divider-client">
                  <span>ou</span>
                </div>

                <button 
                  type="button" 
                  className="btn-google-client"
                  onClick={handleGoogleLogin}
                  disabled={isSubmitting || loading}
                >
                  <div className="google-icon-client">G</div>
                  Se connecter avec Google
                </button>

                <div className="forgot-password-adapted-client">
                  <button 
                    type="button" 
                    className="forgot-link-adapted-client"
                    onClick={handleForgotPassword}
                    disabled={isSubmitting || loading}
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
              </form>
            </>
          ) : (
            // Formulaire de réinitialisation du mot de passe
            <div className="reset-form-container">
              <div className="reset-header">
                <div className="reset-icon">🔑</div>
                <h2 className="reset-title">Réinitialiser le mot de passe</h2>
                <p className="reset-subtitle">
                  {!resetSent 
                    ? "Entrez votre adresse email pour recevoir un lien de réinitialisation"
                    : "Un email de réinitialisation a été envoyé !"
                  }
                </p>
              </div>

              {!resetSent ? (
                <form onSubmit={handleResetSubmit} className="reset-form">
                  <div className="form-group-adapted-client">
                    <label htmlFor="resetEmail" className="form-label-adapted-client">
                      <span className="label-icon-client">📧</span>
                      Adresse email
                    </label>
                    <input
                      type="email"
                      id="resetEmail"
                      name="resetEmail"
                      className="form-input-adapted-client"
                      placeholder="tanzifelix@gmail.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                    />
                  </div>

                  <button type="submit" className="btn-primary-adapted-client reset-btn">
                    <span className="btn-icon-client">📧</span>
                    ENVOYER
                  </button>
                </form>
              ) : (
                <div className="reset-success">
                  <div className="success-icon">✅</div>
                  <p className="success-message">
                    Vérifiez votre boîte email et suivez les instructions pour réinitialiser votre mot de passe.
                  </p>
                  <div className="loading-bar">
                    <div className="loading-progress"></div>
                  </div>
                </div>
              )}

              <button 
                className="back-to-login-btn"
                onClick={() => setShowForgotForm(false)}
              >
                ← Retour à la connexion
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LogClient;