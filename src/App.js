import React, { useState } from 'react';
import HomePage from './Compo/HomePage';
import LogPro from './Compo/LogPro';
import ClientLogin from './Compo/LogClient';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('home');

  const handleNavigation = (view) => {
    setCurrentView(view);
  };

  const renderCurrentView = () => {
    switch(currentView) {
      case 'home':
        return <HomePage onNavigate={handleNavigation} />;
      case 'professional':
        return <LogPro onNavigate={handleNavigation} />;
      case 'client':
        return <ClientLogin onNavigate={handleNavigation} />;
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

export default App;