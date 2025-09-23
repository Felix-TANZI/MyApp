const { 
  query, 
  verifyPassword, 
  generateTokens, 
  createSession,
  revokeSession,
  getSession 
} = require('../utils/auth');

const bcrypt = require('bcryptjs');

// Connexion professionnelle pour le personnel
const loginProfessional = async (req, res) => {
  try {
    const { identifier, password, rememberMe } = req.body;

    // Validation des données
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Identifiant et mot de passe requis'
      });
    }

    // Rechercher l'utilisateur par pseudo, email ou matricule
    const users = await query(`
      SELECT id, nom, prenom, pseudo, email, matricule, mot_de_passe, role, statut 
      FROM users 
      WHERE (pseudo = ? OR email = ? OR matricule = ?) AND statut = 'actif'
    `, [identifier, identifier, identifier]);

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Identifiants invalides'
      });
    }

    const user = users[0];

    console.log('🔍 Tentative connexion professionnelle:', identifier);
    console.log('🔍 Utilisateur trouvé:', user ? 'OUI' : 'NON');

    const isValidPassword = await bcrypt.compare(password, user.mot_de_passe);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Identifiants invalides'
      });
    }

    // CORRECTION: Payload JWT unifié pour le chat
    const payload = {
      userId: user.id,
      userType: 'user', // IMPORTANT pour le chat
      role: user.role,
      nom: user.nom,
      prenom: user.prenom,
      pseudo: user.pseudo,
      // Ajouter tous les champs nécessaires pour le chat
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24h
    };

    const { accessToken, refreshToken } = generateTokens(payload);

    // Créer la session
    const sessionId = await createSession(user.id, 'user', accessToken, refreshToken, req);

    // Mettre à jour la dernière connexion
    await query(
      'UPDATE users SET derniere_connexion = NOW() WHERE id = ?',
      [user.id]
    );

    // Réponse succès avec toutes les informations nécessaires
    res.json({
      success: true,
      message: 'Connexion réussie',
      user: {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        pseudo: user.pseudo,
        email: user.email,
        matricule: user.matricule,
        role: user.role,
        userType: 'user' // AJOUT pour compatibilité
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: '24h'
      },
      sessionId
    });

  } catch (error) {
    console.error('Erreur connexion professionnelle:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la connexion'
    });
  }
};

// Connexion client
const loginClient = async (req, res) => {
  try {
    const { identifier, password, rememberMe } = req.body;

    // Validation des données
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Code client/email et mot de passe requis'
      });
    }

    // Rechercher le client par code_client ou email
    const clients = await query(`
      SELECT id, code_client, nom, prenom, entreprise, email, mot_de_passe, 
             type_client, statut 
      FROM clients 
      WHERE (code_client = ? OR email = ?) AND statut = 'actif' AND deleted_at IS NULL
    `, [identifier, identifier]);

    if (clients.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Identifiants invalides'
      });
    }

    const client = clients[0];

    console.log('🔍 Tentative connexion client:', identifier);
    console.log('🔍 Client trouvé:', client ? 'OUI' : 'NON');

    const isValidPassword = await bcrypt.compare(password, client.mot_de_passe);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Identifiants invalides'
      });
    }

    // CORRECTION: Payload JWT unifié pour le chat
    const payload = {
      userId: client.id,
      userType: 'client', // IMPORTANT pour le chat
      role: 'client',
      nom: client.nom,
      prenom: client.prenom,
      codeClient: client.code_client,
      entreprise: client.entreprise,
      typeClient: client.type_client,
      // Ajouter tous les champs nécessaires
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24h
    };

    const { accessToken, refreshToken } = generateTokens(payload);

    // Créer la session
    const sessionId = await createSession(client.id, 'client', accessToken, refreshToken, req);

    // Mettre à jour la dernière connexion
    await query(
      'UPDATE clients SET derniere_connexion = NOW() WHERE id = ?',
      [client.id]
    );

    // Réponse succès avec toutes les informations nécessaires
    res.json({
      success: true,
      message: 'Connexion réussie',
      client: {
        id: client.id,
        code_client: client.code_client,
        nom: client.nom,
        prenom: client.prenom,
        entreprise: client.entreprise,
        email: client.email,
        type_client: client.type_client,
        userType: 'client' // AJOUT pour compatibilité
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: '24h'
      },
      sessionId
    });

  } catch (error) {
    console.error('Erreur connexion client:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la connexion'
    });
  }
};

// Déconnexion
const logout = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      await revokeSession(token);
    }

    res.json({
      success: true,
      message: 'Déconnexion réussie'
    });

  } catch (error) {
    console.error('Erreur déconnexion:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la déconnexion'
    });
  }
};

// Vérifier le token (middleware général)
const verifyAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token requis'
      });
    }

    // Vérifier le token JWT directement
    const jwt = require('jsonwebtoken');
    let decoded;
    
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        message: 'Token invalide ou expiré'
      });
    }

    // Vérifier si la session existe toujours
    const session = await getSession(token);
    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Session expirée'
      });
    }

    // Ajouter les infos à la requête
    req.user = {
      id: decoded.userId,
      type: decoded.userType,
      role: decoded.role,
      sessionId: session.id,
      decoded // Ajouter le token décodé complet
    };

    next();

  } catch (error) {
    console.error('Erreur vérification auth:', error);
    res.status(403).json({
      success: false,
      message: 'Token invalide'
    });
  }
};

// CORRECTION: Middleware d'authentification spécifique pour le chat
const verifyChatAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token requis pour le chat'
      });
    }

    // Vérifier le token JWT directement
    const jwt = require('jsonwebtoken');
    let decoded;
    
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('🔐 Token chat décodé:', decoded);
    } catch (jwtError) {
      console.error('Erreur JWT chat:', jwtError);
      return res.status(401).json({
        success: false,
        message: 'Token invalide ou expiré'
      });
    }

    // Vérifier si la session existe
    const session = await getSession(token);
    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Session expirée'
      });
    }

    // Récupérer les détails de l'utilisateur selon le type
    let userDetails = null;
    let userId = decoded.userId;
    let userType = decoded.userType;

    if (userType === 'user') {
      const users = await query(
        'SELECT id, nom, prenom, role, pseudo FROM users WHERE id = ? AND statut = "actif"',
        [userId]
      );
      userDetails = users[0] || null;
    } else if (userType === 'client') {
      const clients = await query(
        'SELECT id, code_client, nom, prenom, entreprise FROM clients WHERE id = ? AND statut = "actif" AND deleted_at IS NULL',
        [userId]
      );
      userDetails = clients[0] || null;
    }

    if (!userDetails) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé ou inactif'
      });
    }

    // Ajouter les infos détaillées à la requête
    req.user = {
      id: userId,
      type: userType,
      sessionId: session.id,
      userType: userType, // Alias pour compatibilité
      details: userDetails,
      decoded: decoded // Token complet pour debug
    };

    console.log('✅ Auth chat réussie:', { userId, userType, nom: userDetails.nom });

    next();

  } catch (error) {
    console.error('Erreur auth chat:', error);
    res.status(403).json({
      success: false,
      message: 'Erreur d\'authentification chat'
    });
  }
};

// Profil utilisateur
const getProfile = async (req, res) => {
  try {
    const { id, type } = req.user;

    let profile;
    if (type === 'user') {
      const users = await query(
        'SELECT id, nom, prenom, pseudo, email, matricule, role FROM users WHERE id = ?',
        [id]
      );
      profile = users[0];
    } else {
      const clients = await query(
        'SELECT id, code_client, nom, prenom, entreprise, email, type_client FROM clients WHERE id = ?',
        [id]
      );
      profile = clients[0];
    }

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profil introuvable'
      });
    }

    res.json({
      success: true,
      profile,
      userType: type
    });

  } catch (error) {
    console.error('Erreur récupération profil:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// NOUVELLE FONCTION: Vérification du token pour les WebSockets
const verifySocketToken = async (token) => {
  try {
    if (!token) {
      throw new Error('Token manquant');
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Vérifier la session
    const session = await getSession(token);
    if (!session) {
      throw new Error('Session expirée');
    }

    // Récupérer les détails utilisateur
    let userDetails = null;
    const userId = decoded.userId;
    const userType = decoded.userType;

    if (userType === 'user') {
      const users = await query(
        'SELECT id, nom, prenom, role, pseudo FROM users WHERE id = ? AND statut = "actif"',
        [userId]
      );
      userDetails = users[0];
    } else if (userType === 'client') {
      const clients = await query(
        'SELECT id, code_client, nom, prenom, entreprise FROM clients WHERE id = ? AND statut = "actif" AND deleted_at IS NULL',
        [userId]
      );
      userDetails = clients[0];
    }

    if (!userDetails) {
      throw new Error('Utilisateur non trouvé');
    }

    return {
      userId,
      userType,
      userDetails,
      decoded,
      sessionId: session.id
    };

  } catch (error) {
    console.error('Erreur vérification token socket:', error);
    throw error;
  }
};

module.exports = {
  loginProfessional,
  loginClient,
  logout,
  verifyAuth,
  verifyChatAuth, // Export du middleware chat
  getProfile,
  verifySocketToken // NOUVEAU: pour les WebSockets
};