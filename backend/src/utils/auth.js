const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Configuration base de données
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3307,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gestionFac'
};

// Pool de connexions
const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Fonction query
const query = async (sql, params = []) => {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('Erreur base de données:', error);
    throw error;
  }
};

// Vérifier mot de passe
const verifyPassword = async (plainPassword, hashedPassword) => {
  try {
    return await bcrypt.compare(plainPassword, hashedPassword);
  } catch (error) {
    console.error('Erreur vérification mot de passe:', error);
    return false;
  }
};

// Générer les tokens sans conflit exp
const generateTokens = (payload) => {
  try {
    const cleanPayload = { ...payload };
    delete cleanPayload.exp; // Supprimer exp s'il existe
    delete cleanPayload.iat; // Supprimer iat s'il existe

    // Générer access token avec expiresIn
    const accessToken = jwt.sign(
      cleanPayload, 
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '24h' }
    );

    // Générer refresh token avec expiresIn plus long
    const refreshToken = jwt.sign(
      { userId: cleanPayload.userId, userType: cleanPayload.userType },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
    );

    return { accessToken, refreshToken };
  } catch (error) {
    console.error('Erreur génération tokens:', error);
    throw error;
  }
};

// Créer une session
const createSession = async (userId, userType, accessToken, refreshToken, req) => {
  try {
    // Hacher le token pour le stockage
    const tokenHash = await bcrypt.hash(accessToken, 10);
    const refreshTokenHash = refreshToken ? await bcrypt.hash(refreshToken, 10) : null;

    // Créer la session
    const result = await query(`
      INSERT INTO sessions (
        ${userType === 'user' ? 'user_id' : 'client_id'}, 
        user_type, 
        token_hash, 
        refresh_token, 
        ip_address, 
        user_agent, 
        expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))
    `, [
      userId,
      userType,
      tokenHash,
      refreshTokenHash,
      req.ip || req.connection?.remoteAddress || 'unknown',
      req.get('User-Agent') || 'unknown'
    ]);

    return result.insertId;
  } catch (error) {
    console.error('Erreur création session:', error);
    throw error;
  }
};

// Révoquer une session
const revokeSession = async (token) => {
  try {
    // Marquer la session comme révoquée
    await query(`
      UPDATE sessions 
      SET revoked = TRUE 
      WHERE token_hash = ? OR refresh_token = ?
    `, [token, token]);

    return true;
  } catch (error) {
    console.error('Erreur révocation session:', error);
    return false;
  }
};

// Obtenir une session
const getSession = async (token) => {
  try {
    // Décoder le token pour obtenir les infos
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      console.log('Token invalide ou expiré:', jwtError.message);
      return null;
    }

    // Chercher la session correspondante
    const sessions = await query(`
      SELECT s.*, 
             CASE 
               WHEN s.user_type = 'user' THEN u.nom
               WHEN s.user_type = 'client' THEN c.nom
             END as user_nom,
             CASE 
               WHEN s.user_type = 'user' THEN u.prenom  
               WHEN s.user_type = 'client' THEN c.prenom
             END as user_prenom
      FROM sessions s
      LEFT JOIN users u ON s.user_type = 'user' AND s.user_id = u.id
      LEFT JOIN clients c ON s.user_type = 'client' AND s.client_id = c.id
      WHERE s.expires_at > NOW() 
        AND s.revoked = FALSE
        AND (s.user_id = ? OR s.client_id = ?)
      ORDER BY s.date_creation DESC
      LIMIT 1
    `, [decoded.userId, decoded.userId]);

    if (sessions.length === 0) {
      return null;
    }

    return sessions[0];
  } catch (error) {
    console.error('Erreur récupération session:', error);
    return null;
  }
};

// Nettoyer les sessions expirées
const cleanupSessions = async () => {
  try {
    const result = await query(`
      DELETE FROM sessions 
      WHERE expires_at < NOW() OR revoked = TRUE
    `);

    console.log(`Sessions nettoyées: ${result.affectedRows}`);
    return result.affectedRows;
  } catch (error) {
    console.error('Erreur nettoyage sessions:', error);
    return 0;
  }
};

// Vérifier si un token est valide
const verifyToken = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const session = await getSession(token);
    
    return session ? { decoded, session } : null;
  } catch (error) {
    console.log('Token non valide:', error.message);
    return null;
  }
};

module.exports = {
  query,
  verifyPassword,
  generateTokens,
  createSession,
  revokeSession,
  getSession,
  cleanupSessions,
  verifyToken,
  pool
};