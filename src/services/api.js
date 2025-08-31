const API_BASE_URL = 'http://localhost:5000/api';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = localStorage.getItem('accessToken');
  }

  // Configuration des headers
  getHeaders(includeAuth = true) {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (includeAuth && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  // Méthode générique pour les appels API
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    const config = {
      headers: this.getHeaders(options.includeAuth !== false),
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erreur API');
      }

      return data;
    } catch (error) {
      console.error(`Erreur API ${endpoint}:`, error);
      throw error;
    }
  }

  // Sauvegarder le token
  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('accessToken', token);
    } else {
      localStorage.removeItem('accessToken');
    }
  }

  // Récupérer le token
  getToken() {
    return this.token || localStorage.getItem('accessToken');
  }

  // Supprimer le token
  removeToken() {
    this.token = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userProfile');
  }

  // AUTHENTIFICATION

  // Connexion du personnel
  async loginProfessional(credentials) {
    const response = await this.request('/auth/login/professional', {
      method: 'POST',
      body: JSON.stringify(credentials),
      includeAuth: false
    });

    if (response.success) {
      this.setToken(response.tokens.accessToken);
      localStorage.setItem('refreshToken', response.tokens.refreshToken);
      localStorage.setItem('userProfile', JSON.stringify(response.user));
      localStorage.setItem('userType', 'professional');
    }

    return response;
  }

  // Connexion du client
  async loginClient(credentials) {
    const response = await this.request('/auth/login/client', {
      method: 'POST',
      body: JSON.stringify(credentials),
      includeAuth: false
    });

    if (response.success) {
      this.setToken(response.tokens.accessToken);
      localStorage.setItem('refreshToken', response.tokens.refreshToken);
      localStorage.setItem('userProfile', JSON.stringify(response.client));
      localStorage.setItem('userType', 'client');
    }

    return response;
  }

  // Déconnexion
  async logout() {
    try {
      await this.request('/auth/logout', {
        method: 'POST'
      });
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    } finally {
      this.removeToken();
    }
  }

  // Vérifier si connecté
  async verifyAuth() {
    if (!this.getToken()) {
      return { success: false, message: 'Aucun token' };
    }

    try {
      const response = await this.request('/auth/verify');
      return response;
    } catch (error) {
      this.removeToken();
      return { success: false, message: 'Token invalide' };
    }
  }

  // Récupérer le profil
  async getProfile() {
    return await this.request('/auth/profile');
  }

  // UTILITAIRES 

  // Récupérer les infos utilisateur stockées
  getCurrentUser() {
    const profile = localStorage.getItem('userProfile');
    const userType = localStorage.getItem('userType');
    
    if (profile) {
      return {
        ...JSON.parse(profile),
        userType
      };
    }
    return null;
  }

  // Vérifier si utilisateur connecté
  isAuthenticated() {
    return !!this.getToken();
  }

  // Vérifier le type d'utilisateur
  getUserType() {
    return localStorage.getItem('userType');
  }

  // Vérifier si admin
  isAdmin() {
    const user = this.getCurrentUser();
    return user && user.role === 'admin';
  }

  // Vérifier si commercial
  isCommercial() {
    const user = this.getCurrentUser();
    return user && (user.role === 'commercial' || user.role === 'admin');
  }

  // Vérifier si comptable
  isComptable() {
    const user = this.getCurrentUser();
    return user && (user.role === 'comptable' || user.role === 'admin');
  }

  // Vérifier si client
  isClient() {
    return this.getUserType() === 'client';
  }
}

// Instance singleton
const apiService = new ApiService();

export default apiService;