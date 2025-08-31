import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import HomePage from './Compo/HomePage';
import LogPro from './Compo/LogPro';
import LogClient from './Compo/LogClient';
import Dashboard from './Compo/Dashboard'; // À ameliorer par la suite, nous avons juste une version test
import './App.css';

// Composant principal avec logique de navigation
function AppContent() {
  const [currentView, setCurrentView] = useState('home');
  const { isAuthenticated, userType, loading } = useAuth();

  const handleNavigation = (view) => {
    setCurrentView(view);
  };

  // Affichage de chargement
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f8f9fb 0%, #e8eef7 100%)'
      }}>
        <div style={{
          textAlign: 'center',
          color: '#0F4C8C'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
          <p>Chargement...</p>
        </div>
      </div>
    );
  }

  // Si utilisateur connecté, afficher le dashboard approprié
  if (isAuthenticated) {
    return <Dashboard onNavigate={handleNavigation} />;
  }

  // Sinon afficher les pages de connexion
  const renderCurrentView = () => {
    switch(currentView) {
      case 'home':
        return <HomePage onNavigate={handleNavigation} />;
      case 'professional':
        return <LogPro onNavigate={handleNavigation} />;
      case 'client':
        return <LogClient onNavigate={handleNavigation} />;
      default:
        return <HomePage onNavigate={handleNavigation} />;
    }
  };

  return (
    <div className="App">
      {renderCurrentView()}
    </div>
  );
}

// App principal avec Provider
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;