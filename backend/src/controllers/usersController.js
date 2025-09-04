const { query } = require('../utils/auth');
const bcrypt = require('bcryptjs');

// Fonction pour générer le prochain matricule par rôle, l'idee est d'auto incremente les matricules
const generateMatricule = async (role) => {
  let prefix;
  switch (role) {
    case 'admin':
      prefix = 'ADM';
      break;
    case 'commercial':
      prefix = 'COM';
      break;
    case 'comptable':
      prefix = 'CMP';
      break;
    default:
      throw new Error('Rôle invalide');
  }
  
  // Ici il est question de trouver le prochain numéro disponible pour ce rôle
  const existingMatricules = await query(
    'SELECT matricule FROM users WHERE matricule LIKE ? ORDER BY matricule DESC LIMIT 1',
    [`${prefix}%`]
  );
  
  let nextNumber = 1;
  if (existingMatricules.length > 0) {
    const lastMatricule = existingMatricules[0].matricule;
    const lastNumber = parseInt(lastMatricule.substring(3));
    nextNumber = lastNumber + 1;
  }
  
  return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
};

// GET /api/users - Liste des utilisateurs avec pagination et recherche
const getUsers = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
    const search = String(req.query.search || '').trim();
    const role = String(req.query.role || '').trim();
    const statut = String(req.query.statut || '').trim();
    const sortBy = String(req.query.sortBy || 'date_creation');
    const sortOrder = String(req.query.sortOrder || 'DESC').toUpperCase();
    
    const offset = (page - 1) * limit;
    
    console.log('Params reçus:', { page, limit, offset, search, role, statut });
    
    // Construction de la requête de recherche
    let whereConditions = [];
    let queryParams = [];
    
    if (search) {
      whereConditions.push(`(
        nom LIKE ? OR 
        prenom LIKE ? OR 
        pseudo LIKE ? OR 
        email LIKE ? OR 
        matricule LIKE ?
      )`);
      const searchParam = `%${search}%`;
      queryParams.push(searchParam, searchParam, searchParam, searchParam, searchParam);
    }
    
    if (role && ['admin', 'commercial', 'comptable'].includes(role)) {
      whereConditions.push('role = ?');
      queryParams.push(role);
    }
    
    if (statut && ['actif', 'inactif', 'suspendu'].includes(statut)) {
      whereConditions.push('statut = ?');
      queryParams.push(statut);
    }
    
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';
    
    // Requête pour compter le total
    const [countResult] = await query(`SELECT COUNT(*) as total FROM users ${whereClause}`, queryParams);
    const total = countResult.total;
    console.log(`Total utilisateurs trouvés: ${total}`);
    
    // Validation sortBy pour éviter les injections SQL
    const allowedSortFields = ['date_creation', 'nom', 'prenom', 'pseudo', 'email', 'matricule', 'role', 'statut', 'derniere_connexion'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'date_creation';
    const safeSortOrder = ['ASC', 'DESC'].includes(sortOrder) ? sortOrder : 'DESC';
    
    // Requête principale avec LIMIT et OFFSET
    const usersQuery = `
      SELECT 
        id,
        nom,
        prenom,
        pseudo,
        email,
        matricule,
        role,
        statut,
        derniere_connexion,
        date_creation,
        date_modification
      FROM users 
      ${whereClause}
      ORDER BY ${safeSortBy} ${safeSortOrder}
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    console.log('Requête finale:', usersQuery);
    console.log('Paramètres de filtrage:', queryParams);
    
    const users = await query(usersQuery, queryParams);
    
    console.log(`${users.length} utilisateurs récupérés`);
    
    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Erreur récupération utilisateurs:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des utilisateurs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// GET /api/users/stats - Statistiques des utilisateurs
const getUsersStats = async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins,
        COUNT(CASE WHEN role = 'commercial' THEN 1 END) as commerciaux,
        COUNT(CASE WHEN role = 'comptable' THEN 1 END) as comptables,
        COUNT(CASE WHEN statut = 'actif' THEN 1 END) as actifs,
        COUNT(CASE WHEN statut = 'inactif' THEN 1 END) as inactifs,
        COUNT(CASE WHEN statut = 'suspendu' THEN 1 END) as suspendus,
        COUNT(CASE WHEN DATE(date_creation) = CURDATE() THEN 1 END) as nouveaux_aujourd_hui,
        COUNT(CASE WHEN YEARWEEK(date_creation) = YEARWEEK(CURDATE()) THEN 1 END) as nouveaux_semaine,
        COUNT(CASE WHEN MONTH(date_creation) = MONTH(CURDATE()) AND YEAR(date_creation) = YEAR(CURDATE()) THEN 1 END) as nouveaux_mois
      FROM users
    `);

    res.json({
      success: true,
      data: stats[0]
    });

  } catch (error) {
    console.error('Erreur statistiques utilisateurs:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des statistiques'
    });
  }
};

// GET /api/users/:id - Récupérer un utilisateur spécifique
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const users = await query(`
      SELECT 
        id,
        nom,
        prenom,
        pseudo,
        email,
        matricule,
        role,
        statut,
        derniere_connexion,
        date_creation,
        date_modification
      FROM users 
      WHERE id = ?
    `, [id]);
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur introuvable'
      });
    }
    
    res.json({
      success: true,
      data: users[0]
    });

  } catch (error) {
    console.error('Erreur récupération utilisateur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération de l\'utilisateur'
    });
  }
};

// POST /api/users - Créer un nouvel utilisateur
const createUser = async (req, res) => {
  try {
    const {
      nom,
      prenom,
      pseudo,
      email,
      role,
      mot_de_passe,
      statut = 'actif'
    } = req.body;

    // Validation des champs obligatoires
    if (!nom || !prenom || !pseudo || !email || !role || !mot_de_passe) {
      return res.status(400).json({
        success: false,
        message: 'Tous les champs obligatoires doivent être remplis'
      });
    }

    // Validation du rôle
    if (!['admin', 'commercial', 'comptable'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Rôle invalide'
      });
    }

    // Vérification si le pseudo existe déjà
    const existingPseudo = await query('SELECT id FROM users WHERE pseudo = ?', [pseudo]);
    if (existingPseudo.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Ce pseudo est déjà utilisé'
      });
    }

    // Vérification si l'email existe déjà
    const existingEmail = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingEmail.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cet email est déjà utilisé'
      });
    }

    // Générer le matricule selon le rôle
    const matricule = await generateMatricule(role);

    // Hacher le mot de passe
    const hashedPassword = await bcrypt.hash(mot_de_passe, 12);

    // Créer l'utilisateur
    const result = await query(`
      INSERT INTO users (
        nom, prenom, pseudo, email, matricule, mot_de_passe, role, statut
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [nom, prenom, pseudo, email, matricule, hashedPassword, role, statut]);

    // Récupérer l'utilisateur créé (sans le mot de passe)
    const newUser = await query(`
      SELECT 
        id, nom, prenom, pseudo, email, matricule, role, statut, date_creation
      FROM users 
      WHERE id = ?
    `, [result.insertId]);

    // Log de l'action
    await query(`
      INSERT INTO historique_actions (
        user_id, user_type, action, table_concernee, 
        enregistrement_id, nouvelles_valeurs, ip_address
      ) VALUES (?, 'user', 'CREATE_USER', 'users', ?, ?, ?)
    `, [
      req.user.id, 
      result.insertId, 
      JSON.stringify(newUser[0]),
      req.ip || 'unknown'
    ]);

    res.status(201).json({
      success: true,
      message: 'Utilisateur créé avec succès',
      data: newUser[0]
    });

  } catch (error) {
    console.error('Erreur création utilisateur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la création de l\'utilisateur'
    });
  }
};

// PUT /api/users/:id - Modifier un utilisateur
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nom,
      prenom,
      pseudo,
      email,
      statut
    } = req.body;

    // Vérification que l'utilisateur existe
    const existingUsers = await query('SELECT * FROM users WHERE id = ?', [id]);
    if (existingUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur introuvable'
      });
    }

    const existingUser = existingUsers[0];

    // Empêcher la modification de son propre compte (sauf cas spéciaux)
    if (req.user.id === parseInt(id) && statut !== existingUser.statut) {
      return res.status(400).json({
        success: false,
        message: 'Vous ne pouvez pas modifier votre propre statut'
      });
    }

    // Vérifier si le pseudo est déjà utilisé par un autre utilisateur
    if (pseudo !== existingUser.pseudo) {
      const pseudoExists = await query(
        'SELECT id FROM users WHERE pseudo = ? AND id != ?',
        [pseudo, id]
      );
      if (pseudoExists.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Ce pseudo est déjà utilisé par un autre utilisateur'
        });
      }
    }

    // Vérification si l'email est déjà utilisé par un autre utilisateur
    if (email !== existingUser.email) {
      const emailExists = await query(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, id]
      );
      if (emailExists.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cet email est déjà utilisé par un autre utilisateur'
        });
      }
    }

    // Mettre à jour l'utilisateur (sans changer le rôle et le matricule)
    await query(`
      UPDATE users SET
        nom = ?, prenom = ?, pseudo = ?, email = ?, statut = ?,
        date_modification = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [nom, prenom, pseudo, email, statut, id]);

    // Récupérer l'utilisateur modifié
    const updatedUser = await query(`
      SELECT 
        id, nom, prenom, pseudo, email, matricule, role, statut,
        date_creation, date_modification
      FROM users 
      WHERE id = ?
    `, [id]);

    // Log de l'action
    await query(`
      INSERT INTO historique_actions (
        user_id, user_type, action, table_concernee, 
        enregistrement_id, anciennes_valeurs, nouvelles_valeurs, ip_address
      ) VALUES (?, 'user', 'UPDATE_USER', 'users', ?, ?, ?, ?)
    `, [
      req.user.id, 
      id,
      JSON.stringify(existingUser),
      JSON.stringify(updatedUser[0]),
      req.ip || 'unknown'
    ]);

    res.json({
      success: true,
      message: 'Utilisateur modifié avec succès',
      data: updatedUser[0]
    });

  } catch (error) {
    console.error('Erreur modification utilisateur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la modification de l\'utilisateur'
    });
  }
};

// PUT /api/users/:id/role - Changer le rôle d'un utilisateur
const changeUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, justification } = req.body;

    // Validation du rôle
    if (!['admin', 'commercial', 'comptable'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Rôle invalide'
      });
    }

    // Vérifier que l'utilisateur existe
    const existingUsers = await query('SELECT * FROM users WHERE id = ?', [id]);
    if (existingUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur introuvable'
      });
    }

    const existingUser = existingUsers[0];

    // Empêcher de changer son propre rôle
    if (req.user.id === parseInt(id)) {
      return res.status(400).json({
        success: false,
        message: 'Vous ne pouvez pas modifier votre propre rôle'
      });
    }

    // Générer un nouveau matricule si le rôle change
    let nouveauMatricule = existingUser.matricule;
    if (existingUser.role !== role) {
      nouveauMatricule = await generateMatricule(role);
    }

    // Mettre à jour le rôle et le matricule
    await query(`
      UPDATE users SET
        role = ?, matricule = ?, date_modification = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [role, nouveauMatricule, id]);

    // Récupérer l'utilisateur modifié
    const updatedUser = await query(`
      SELECT 
        id, nom, prenom, pseudo, email, matricule, role, statut,
        date_creation, date_modification
      FROM users 
      WHERE id = ?
    `, [id]);

    // Log de l'action avec justification
    await query(`
      INSERT INTO historique_actions (
        user_id, user_type, action, table_concernee, 
        enregistrement_id, anciennes_valeurs, nouvelles_valeurs, ip_address
      ) VALUES (?, 'user', 'CHANGE_ROLE', 'users', ?, ?, ?, ?)
    `, [
      req.user.id, 
      id,
      JSON.stringify({ ...existingUser, justification }),
      JSON.stringify(updatedUser[0]),
      req.ip || 'unknown'
    ]);

    res.json({
      success: true,
      message: `Rôle modifié avec succès vers ${role}`,
      data: updatedUser[0]
    });

  } catch (error) {
    console.error('Erreur changement rôle:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors du changement de rôle'
    });
  }
};

// PUT /api/users/:id/password - Changer le mot de passe d'un utilisateur
const changeUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { nouveau_mot_de_passe } = req.body;

    if (!nouveau_mot_de_passe || nouveau_mot_de_passe.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Le mot de passe doit contenir au moins 6 caractères'
      });
    }

    // Vérifier que l'utilisateur existe
    const existingUsers = await query('SELECT nom, prenom FROM users WHERE id = ?', [id]);
    if (existingUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur introuvable'
      });
    }

    // Hacher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(nouveau_mot_de_passe, 12);

    // Mettre à jour le mot de passe
    await query(`
      UPDATE users SET
        mot_de_passe = ?, date_modification = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [hashedPassword, id]);

    // Log de l'action (sans enregistrer le mot de passe)
    await query(`
      INSERT INTO historique_actions (
        user_id, user_type, action, table_concernee, 
        enregistrement_id, nouvelles_valeurs, ip_address
      ) VALUES (?, 'user', 'CHANGE_PASSWORD', 'users', ?, ?, ?)
    `, [
      req.user.id, 
      id,
      JSON.stringify({ action: 'Mot de passe modifié', target: existingUsers[0] }),
      req.ip || 'unknown'
    ]);

    res.json({
      success: true,
      message: 'Mot de passe modifié avec succès'
    });

  } catch (error) {
    console.error('Erreur changement mot de passe:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors du changement de mot de passe'
    });
  }
};

// POST /api/users/:id/toggle-status - Activer/Désactiver un utilisateur
const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que l'utilisateur existe
    const users = await query('SELECT statut, nom, prenom FROM users WHERE id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur introuvable'
      });
    }

    // Empêcher de désactiver son propre compte
    if (req.user.id === parseInt(id)) {
      return res.status(400).json({
        success: false,
        message: 'Vous ne pouvez pas modifier votre propre statut'
      });
    }

    const currentStatus = users[0].statut;
    const newStatus = currentStatus === 'actif' ? 'inactif' : 'actif';

    await query(
      'UPDATE users SET statut = ?, date_modification = CURRENT_TIMESTAMP WHERE id = ?',
      [newStatus, id]
    );

    // Log de l'action
    await query(`
      INSERT INTO historique_actions (
        user_id, user_type, action, table_concernee, 
        enregistrement_id, nouvelles_valeurs, ip_address
      ) VALUES (?, 'user', 'TOGGLE_STATUS', 'users', ?, ?, ?)
    `, [
      req.user.id, 
      id,
      JSON.stringify({ 
        action: `${newStatus === 'actif' ? 'Activation' : 'Désactivation'}`,
        target: users[0],
        newStatus 
      }),
      req.ip || 'unknown'
    ]);

    res.json({
      success: true,
      message: `Utilisateur ${newStatus === 'actif' ? 'activé' : 'désactivé'} avec succès`,
      data: { statut: newStatus }
    });

  } catch (error) {
    console.error('Erreur changement statut utilisateur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors du changement de statut'
    });
  }
};

// DELETE /api/users/:id - Supprimer un utilisateur (soft delete)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que l'utilisateur existe
    const existingUsers = await query('SELECT * FROM users WHERE id = ?', [id]);
    if (existingUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur introuvable'
      });
    }

    const existingUser = existingUsers[0];

    // Empêcher l'auto-suppression
    if (req.user.id === parseInt(id)) {
      return res.status(400).json({
        success: false,
        message: 'Vous ne pouvez pas supprimer votre propre compte'
      });
    }

    // Vérifier s'il y a des actions importantes associées à cet utilisateur
    const userActions = await query(`
      SELECT COUNT(*) as count FROM historique_actions WHERE user_id = ?
      UNION ALL
      SELECT COUNT(*) as count FROM factures WHERE user_id = ?
    `, [id, id]);

    const hasImportantData = userActions.some(result => result.count > 0);

    if (hasImportantData) {
      // Soft delete : désactiver au lieu de supprimer
      await query(
        'UPDATE users SET statut = ?, date_modification = CURRENT_TIMESTAMP WHERE id = ?',
        ['inactif', id]
      );

      // Log de l'action
      await query(`
        INSERT INTO historique_actions (
          user_id, user_type, action, table_concernee, 
          enregistrement_id, anciennes_valeurs, ip_address
        ) VALUES (?, 'user', 'SOFT_DELETE', 'users', ?, ?, ?)
      `, [
        req.user.id, 
        id,
        JSON.stringify({ ...existingUser, reason: 'Données liées existantes' }),
        req.ip || 'unknown'
      ]);

      return res.json({
        success: true,
        message: 'Utilisateur désactivé (données liées conservées)'
      });
    } else {
      // Suppression réelle si aucune donnée importante
      await query('DELETE FROM users WHERE id = ?', [id]);

      // Log de l'action
      await query(`
        INSERT INTO historique_actions (
          user_id, user_type, action, table_concernee, 
          enregistrement_id, anciennes_valeurs, ip_address
        ) VALUES (?, 'user', 'HARD_DELETE', 'users', ?, ?, ?)
      `, [
        req.user.id, 
        id,
        JSON.stringify(existingUser),
        req.ip || 'unknown'
      ]);

      res.json({
        success: true,
        message: 'Utilisateur supprimé définitivement'
      });
    }

  } catch (error) {
    console.error('Erreur suppression utilisateur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la suppression de l\'utilisateur'
    });
  }
};

module.exports = {
  getUsers,
  getUsersStats,
  getUserById,
  createUser,
  updateUser,
  changeUserRole,
  changeUserPassword,
  toggleUserStatus,
  deleteUser
};