import React, { useState } from 'react';
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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Nous allons implementer la logique de connexion
    console.log('Client Login:', formData);
  };

  const handleGoogleLogin = () => {
    // Nous allons implementer une logique de connexion via d'authentification Google en utilisant propablement une API
    console.log('Google Login initiated');
  };

  const handleForgotPassword = () => {
    setShowForgotForm(true);
  };

  const handleResetSubmit = (e) => {
    e.preventDefault();
    // Logique de réinitialisation à implémenter
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
                  />
                  <label htmlFor="rememberMe" className="checkbox-label-adapted-client">
                    Se souvenir de moi
                  </label>
                </div>

                <button type="submit" className="btn-primary-adapted-client">
                  <span className="btn-icon-client"></span>
                  Connexion
                </button>

                <div className="divider-client">
                  <span>ou</span>
                </div>

                <button 
                  type="button" 
                  className="btn-google-client"
                  onClick={handleGoogleLogin}
                >
                  <div className="google-icon-client">G</div>
                  Se connecter avec Google
                </button>

                <div className="forgot-password-adapted-client">
                  <button 
                    type="button" 
                    className="forgot-link-adapted-client"
                    onClick={handleForgotPassword}
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
                      placeholder="tanzifelix@exemple.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                    />
                  </div>

                  <button type="submit" className="btn-primary-adapted-client reset-btn">
                    <span className="btn-icon-client"></span>
                    ENVOYER
                  </button>
                </form>
              ) : (
                // Ici,on implementera cette partie plus tard, il sera question d'envoyer un code dans la boite mail du client
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