const { 
  query, 
  verifyPassword, 
  generateTokens, 
  createSession,
  revokeSession,
  getSession 
} = require('../utils/auth');

const bcrypt = require('bcryptjs');

// Connexion professionnelle pour le personnelle
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

    console.log('🔍 Tentative connexion:', identifier);
    console.log('🔍 Utilisateur trouvé:', user ? 'OUI' : 'NON');
    console.log('🔍 Mot de passe DB:', user?.mot_de_passe);
    console.log('🔍 Mot de passe saisi:', password);

    // Pour l'instant nous nous sommes limites pour les utilisateurs deja present dans la bd et on a juste fait une comparaison entre le mot de passe clair et le mots de passe hache
    
    const isValidPassword = await bcrypt.compare(password, user.mot_de_passe);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Identifiants invalides'
      });
    }

    // Générer les tokens
    const payload = {
      userId: user.id,
      userType: 'user',
      role: user.role,
      nom: user.nom,
      prenom: user.prenom
    };

    const { accessToken, refreshToken } = generateTokens(payload);

    // Créer la session
    const sessionId = await createSession(user.id, 'user', accessToken, refreshToken, req);

    // Mettre à jour la dernière connexion
    await query(
      'UPDATE users SET derniere_connexion = NOW() WHERE id = ?',
      [user.id]
    );

    // Réponse succès
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
        role: user.role
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: '24h'
      }
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
      WHERE (code_client = ? OR email = ?) AND statut = 'actif'
    `, [identifier, identifier]);

    if (clients.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Identifiants invalides'
      });
    }

    const client = clients[0];

    // Vérifier le mot de passe, on utilise le meme principeque plus haut (Par contre la logique client on a pas encore implemente)
    const isValidPassword = await bcrypt.compare(password, client.mot_de_passe);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Identifiants invalides'
      });
    }

    // Générer les tokens
    const payload = {
      userId: client.id,
      userType: 'client',
      role: 'client',
      nom: client.nom,
      prenom: client.prenom,
      codeClient: client.code_client
    };

    const { accessToken, refreshToken } = generateTokens(payload);

    // Créer la session
    const sessionId = await createSession(client.id, 'client', accessToken, refreshToken, req);

    // Mettre à jour la dernière connexion
    await query(
      'UPDATE clients SET derniere_connexion = NOW() WHERE id = ?',
      [client.id]
    );

    // Réponse succès
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
        type_client: client.type_client
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: '24h'
      }
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

// Vérifier le token (middleware)
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

    const session = await getSession(token);
    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Session expirée'
      });
    }

    // Ajouter les infos à la requête
    req.user = {
      id: session.user_id || session.client_id,
      type: session.user_type,
      sessionId: session.id
    };

    next();

  } catch (error) {
    res.status(403).json({
      success: false,
      message: 'Token invalide'
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

module.exports = {
  loginProfessional,
  loginClient,
  logout,
  verifyAuth,
  getProfile
};