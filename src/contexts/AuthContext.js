import React, { createContext, useContext, useReducer, useEffect } from 'react';
import apiService from '../services/api';

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
    throw new Error('useAuth doit etre utilise dans AuthProvider');
  }
  return context;
};

// Provider
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Vérifier l'authentification au chargement
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    dispatch({ type: AuthActions.SET_LOADING, payload: true });

    try {
      const response = await apiService.verifyAuth();
      
      if (response.success) {
        const currentUser = apiService.getCurrentUser();
        const userType = apiService.getUserType();
        
        dispatch({ 
          type: AuthActions.LOGIN_SUCCESS, 
          payload: { 
            user: currentUser,
            userType 
          } 
        });
      } else {
        dispatch({ type: AuthActions.LOGOUT });
      }
    } catch (error) {
      console.error('Erreur vérification auth:', error);
      dispatch({ type: AuthActions.LOGOUT });
    }
  };

  // Connexion du personnel
  const loginProfessional = async (credentials) => {
    dispatch({ type: AuthActions.SET_LOADING, payload: true });

    try {
      const response = await apiService.loginProfessional(credentials);
      
      if (response.success) {
        dispatch({ 
          type: AuthActions.LOGIN_SUCCESS, 
          payload: { 
            user: response.user,
            userType: 'professional' 
          } 
        });
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
      const response = await apiService.loginClient(credentials);
      
      if (response.success) {
        dispatch({ 
          type: AuthActions.LOGIN_SUCCESS, 
          payload: { 
            user: response.client,
            userType: 'client' 
          } 
        });
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
      await apiService.logout();
    } catch (error) {
      console.error('Erreur logout:', error);
    } finally {
      dispatch({ type: AuthActions.LOGOUT });
    }
  };

  // Effacer les erreurs
  const clearError = () => {
    dispatch({ type: AuthActions.CLEAR_ERROR });
  };

  // Mettre à jour le profil
  const updateProfile = (updatedUser) => {
    dispatch({ 
      type: AuthActions.UPDATE_PROFILE, 
      payload: updatedUser 
    });
  };

  // Utilitaires
  const isAdmin = () => state.user && state.user.role === 'admin';
  const isCommercial = () => state.user && (state.user.role === 'commercial' || state.user.role === 'admin');
  const isComptable = () => state.user && (state.user.role === 'comptable' || state.user.role === 'admin');
  const isClient = () => state.userType === 'client';
  const isProfessional = () => state.userType === 'professional';

  const value = {
    // État
    ...state,
    
    // Actions
    loginProfessional,
    loginClient,
    logout,
    clearError,
    updateProfile,
    
    // Utilitaires
    isAdmin,
    isCommercial,
    isComptable,
    isClient,
    isProfessional
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};