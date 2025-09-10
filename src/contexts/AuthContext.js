import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import apiService from '../services/api';
import useNotifications from '../hooks/useNotifications';

// État initial
const initialState = {
  isAuthenticated: false,
  user: null,
  userType: null, // 'professional' ou 'client'
  loading: true,
  error: null
};

// Actions
const AuthActions = {
  SET_LOADING: 'SET_LOADING',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_ERROR: 'LOGIN_ERROR',
  LOGOUT: 'LOGOUT',
  CLEAR_ERROR: 'CLEAR_ERROR',
  UPDATE_PROFILE: 'UPDATE_PROFILE'
};

// Reducer
function authReducer(state, action) {
  switch (action.type) {
    case AuthActions.SET_LOADING:
      return {
        ...state,
        loading: action.payload,
        error: null
      };

    case AuthActions.LOGIN_SUCCESS:
      return {
        ...state,
        isAuthenticated: true,
        user: action.payload.user,
        userType: action.payload.userType,
        loading: false,
        error: null
      };

    case AuthActions.LOGIN_ERROR:
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        userType: null,
        loading: false,
        error: action.payload
      };

    case AuthActions.LOGOUT:
      return {
        ...initialState,
        loading: false
      };

    case AuthActions.CLEAR_ERROR:
      return {
        ...state,
        error: null
      };

    case AuthActions.UPDATE_PROFILE:
      return {
        ...state,
        user: action.payload
      };

    default:
      return state;
  }
}

// Contexte
const AuthContext = createContext();

// Hook personnalisé
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans AuthProvider');
  }
  return context;
};

// Provider
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const initializationRef = useRef(false);
  const notificationsRef = useRef(null);

  // Hook notifications - initialisation différée
  const notifications = useNotifications(state.user, state.userType);
  
  // Stocker la référence des notifications
  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  // Vérifier l'authentification au chargement - une seule fois
  useEffect(() => {
    if (!initializationRef.current) {
      initializationRef.current = true;
      checkAuthStatus();
    }
  }, []);

  const checkAuthStatus = async () => {
    dispatch({ type: AuthActions.SET_LOADING, payload: true });

    try {
      // Vérifier si on a un token stocké
      const token = localStorage.getItem('accessToken');
      if (!token) {
        dispatch({ type: AuthActions.LOGOUT });
        return;
      }

      // Vérifier la validité du token
      const response = await apiService.verifyAuth();
      
      if (response.success) {
        const currentUser = apiService.getCurrentUser();
        const userType = apiService.getUserType();
        
        if (currentUser && userType) {
          dispatch({ 
            type: AuthActions.LOGIN_SUCCESS, 
            payload: { 
              user: currentUser,
              userType 
            } 
          });
        } else {
          throw new Error('Données utilisateur incomplètes');
        }
      } else {
        throw new Error(response.message || 'Token invalide');
      }
    } catch (error) {
      console.error('Erreur vérification auth:', error);
      // Nettoyer les données en cas d'erreur
      apiService.removeToken();
      dispatch({ type: AuthActions.LOGOUT });
    }
  };

  // Connexion du personnel
  const loginProfessional = async (credentials) => {
    dispatch({ type: AuthActions.SET_LOADING, payload: true });

    try {
      // Fermer d'abord toute connexion WebSocket existante
      if (notificationsRef.current?.closeSocket) {
        notificationsRef.current.closeSocket();
      }

      const response = await apiService.loginProfessional(credentials);
      
      if (response.success) {
        dispatch({ 
          type: AuthActions.LOGIN_SUCCESS, 
          payload: { 
            user: response.user,
            userType: 'professional' 
          } 
        });

        // Demander la permission pour les notifications natives après un délai
        setTimeout(() => {
          if ('Notification' in window && notificationsRef.current?.requestNotificationPermission) {
            notificationsRef.current.requestNotificationPermission();
          }
        }, 1000);

        return { success: true };
      } else {
        dispatch({ 
          type: AuthActions.LOGIN_ERROR, 
          payload: response.message 
        });
        return { success: false, message: response.message };
      }
    } catch (error) {
      const errorMessage = error.message || 'Erreur de connexion';
      dispatch({ 
        type: AuthActions.LOGIN_ERROR, 
        payload: errorMessage 
      });
      return { success: false, message: errorMessage };
    }
  };

  // Connexion du client
  const loginClient = async (credentials) => {
    dispatch({ type: AuthActions.SET_LOADING, payload: true });

    try {
      // Fermer d'abord toute connexion WebSocket existante
      if (notificationsRef.current?.closeSocket) {
        notificationsRef.current.closeSocket();
      }

      const response = await apiService.loginClient(credentials);
      
      if (response.success) {
        dispatch({ 
          type: AuthActions.LOGIN_SUCCESS, 
          payload: { 
            user: response.client,
            userType: 'client' 
          } 
        });

        // Demander la permission pour les notifications natives après un délai
        setTimeout(() => {
          if ('Notification' in window && notificationsRef.current?.requestNotificationPermission) {
            notificationsRef.current.requestNotificationPermission();
          }
        }, 1000);

        return { success: true };
      } else {
        dispatch({ 
          type: AuthActions.LOGIN_ERROR, 
          payload: response.message 
        });
        return { success: false, message: response.message };
      }
    } catch (error) {
      const errorMessage = error.message || 'Erreur de connexion';
      dispatch({ 
        type: AuthActions.LOGIN_ERROR, 
        payload: errorMessage 
      });
      return { success: false, message: errorMessage };
    }
  };

  // Déconnexion
  const logout = async () => {
    dispatch({ type: AuthActions.SET_LOADING, payload: true });
    
    try {
      // Fermer la connexion WebSocket des notifications en premier
      if (notificationsRef.current?.closeSocket) {
        notificationsRef.current.closeSocket();
      }

      // Ensuite faire le logout API
      await apiService.logout();
    } catch (error) {
      console.error('Erreur logout:', error);
    } finally {
      // Toujours nettoyer l'état même en cas d'erreur
      dispatch({ type: AuthActions.LOGOUT });
    }
  };

  // Effacer les erreurs
  const clearError = () => {
    dispatch({ type: AuthActions.CLEAR_ERROR });
  };

  // Mettre à jour le profil
  const updateProfile = (updatedUser) => {
    // Mettre à jour aussi dans le localStorage
    localStorage.setItem('userProfile', JSON.stringify(updatedUser));
    
    dispatch({ 
      type: AuthActions.UPDATE_PROFILE, 
      payload: updatedUser 
    });
  };

  // Rafraîchir le profil depuis l'API
  const refreshProfile = async () => {
    try {
      const response = await apiService.getProfile();
      if (response.success) {
        updateProfile(response.profile);
        return response.profile;
      }
    } catch (error) {
      console.error('Erreur rafraîchissement profil:', error);
    }
    return null;
  };

  // Utilitaires
  const isAdmin = () => state.user && state.user.role === 'admin';
  const isCommercial = () => state.user && (state.user.role === 'commercial' || state.user.role === 'admin');
  const isComptable = () => state.user && (state.user.role === 'comptable' || state.user.role === 'admin');
  const isClient = () => state.userType === 'client';
  const isProfessional = () => state.userType === 'professional';

  // Vérifier les permissions pour certaines actions
  const hasPermission = (permission) => {
    if (!state.user) return false;

    const rolePermissions = {
      'admin': ['*'], // Toutes les permissions
      'commercial': ['clients.read', 'clients.write', 'invoices.read', 'invoices.write'],
      'comptable': ['clients.read', 'invoices.read', 'invoices.write', 'payments.read', 'payments.write']
    };

    const userPermissions = rolePermissions[state.user.role] || [];
    return userPermissions.includes('*') || userPermissions.includes(permission);
  };

  // Fonction utilitaire pour gérer la déconnexion automatique
  const handleSessionExpired = () => {
    console.log('Session expirée, déconnexion automatique');
    logout();
  };

  // Écouter les erreurs d'authentification globales
  useEffect(() => {
    const handleAuthError = (event) => {
      if (event.detail && event.detail.type === 'auth_error') {
        handleSessionExpired();
      }
    };

    window.addEventListener('auth_error', handleAuthError);
    return () => {
      window.removeEventListener('auth_error', handleAuthError);
    };
  }, []);

  const value = {
    // État
    ...state,
    
    // Actions
    loginProfessional,
    loginClient,
    logout,
    clearError,
    updateProfile,
    refreshProfile,
    
    // Utilitaires
    isAdmin,
    isCommercial,
    isComptable,
    isClient,
    isProfessional,
    hasPermission,
    handleSessionExpired,
    
    // Notifications
    notifications
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};