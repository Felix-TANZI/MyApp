const { query } = require('../utils/auth');
const bcrypt = require('bcryptjs');

// Générer un code client unique
const generateClientCode = async () => {
  let code;
  let exists = true;
  let attempts = 0;
  
  while (exists && attempts < 10) {
    const year = new Date().getFullYear();
    const randomNum = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    code = `CLT${year}${randomNum}`;
    
    const existing = await query(
      'SELECT id FROM clients WHERE code_client = ?', 
      [code]
    );
    
    exists = existing.length > 0;
    attempts++;
  }
  
  if (exists) {
    throw new Error('Impossible de générer un code client unique');
  }
  
  return code;
};

// GET /api/clients - Liste des clients avec pagination et recherche
const getClients = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
    const search = String(req.query.search || '').trim();
    const type = String(req.query.type || '').trim();
    const statut = String(req.query.statut || '').trim();
    const sortBy = String(req.query.sortBy || 'date_creation');
    const sortOrder = String(req.query.sortOrder || 'DESC').toUpperCase();
    
    const offset = Math.max(0, (page - 1) * limit);
    
    console.log('Params reçus:', { page, limit, offset, search, type, statut });
    
    // Construction de la requête de recherche
    let whereConditions = [];
    let queryParams = [];
    
    if (search) {
      whereConditions.push(`(
        nom LIKE ? OR 
        prenom LIKE ? OR 
        entreprise LIKE ? OR 
        email LIKE ? OR 
        code_client LIKE ? OR 
        telephone LIKE ?
      )`);
      const searchParam = `%${search}%`;
      queryParams.push(searchParam, searchParam, searchParam, searchParam, searchParam, searchParam);
    }
    
    if (type && ['particulier', 'entreprise'].includes(type)) {
      whereConditions.push('type_client = ?');
      queryParams.push(type);
    }
    
    if (statut && ['actif', 'inactif', 'suspendu'].includes(statut)) {
      whereConditions.push('statut = ?');
      queryParams.push(statut);
    }
    
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';
    
    // Requête pour compter le total
    console.log('Comptage des clients...');
    const [countResult] = await query(`SELECT COUNT(*) as total FROM clients ${whereClause}`, queryParams);
    const total = countResult.total;
    console.log(`Total clients trouvés: ${total}`);
    
    // Validation sortBy pour éviter les injections SQL
    const allowedSortFields = ['date_creation', 'nom', 'prenom', 'code_client', 'email', 'type_client', 'statut'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'date_creation';
    const safeSortOrder = ['ASC', 'DESC'].includes(sortOrder) ? sortOrder : 'DESC';
    
    // requête avec LIMIT et OFFSET directement dans le SQL
    const clientsQuery = `
      SELECT 
        id,
        code_client,
        nom,
        prenom,
        entreprise,
        email,
        telephone,
        adresse,
        ville,
        pays,
        type_client,
        statut,
        derniere_connexion,
        date_creation,
        date_modification
      FROM clients 
      ${whereClause}
      ORDER BY ${safeSortBy} ${safeSortOrder}
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    console.log('Requête finale:', clientsQuery);
    console.log('Paramètres de filtrage:', queryParams);
    
    // Exécuter la requête avec SEULEMENT les paramètres de filtrage
    const clients = await query(clientsQuery, queryParams);
    
    console.log(`${clients.length} clients récupérés`);
    
    res.json({
      success: true,
      data: {
        clients,
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
    console.error('Erreur récupération clients:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des clients',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// GET /api/clients/:id - Récupérer un client spécifique
const getClientById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const clients = await query(`
      SELECT 
        id,
        code_client,
        nom,
        prenom,
        entreprise,
        email,
        telephone,
        adresse,
        ville,
        pays,
        type_client,
        statut,
        derniere_connexion,
        date_creation,
        date_modification
      FROM clients 
      WHERE id = ?
    `, [id]);
    
    if (clients.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client introuvable'
      });
    }
    
    // Récupérer les statistiques du client
    const stats = await query(`
      SELECT 
        COUNT(*) as total_factures,
        COALESCE(SUM(montant_ttc), 0) as montant_total,
        COUNT(CASE WHEN statut = 'payee' THEN 1 END) as factures_payees,
        COUNT(CASE WHEN statut = 'en_retard' THEN 1 END) as factures_retard
      FROM factures 
      WHERE client_id = ?
    `, [id]);
    
    res.json({
      success: true,
      data: {
        client: clients[0],
        stats: stats[0]
      }
    });

  } catch (error) {
    console.error('Erreur récupération client:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération du client'
    });
  }
};

// POST /api/clients - Créer un nouveau client
const createClient = async (req, res) => {
  try {
    const {
      nom,
      prenom,
      entreprise,
      email,
      telephone,
      adresse,
      ville = 'Yaoundé',
      pays = 'Cameroun',
      type_client = 'particulier',
      mot_de_passe
    } = req.body;

    // Validation des champs obligatoires
    if (!nom || !email || !mot_de_passe) {
      return res.status(400).json({
        success: false,
        message: 'Nom, email et mot de passe sont obligatoires'
      });
    }

    // Vérifier si l'email existe déjà
    const existingClients = await query(
      'SELECT id FROM clients WHERE email = ?',
      [email]
    );

    if (existingClients.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Un client avec cet email existe déjà'
      });
    }

    // Générer un code client unique
    const codeClient = await generateClientCode();

    // Hacher le mot de passe
    const hashedPassword = await bcrypt.hash(mot_de_passe, 12);

    // Créer le client
    const result = await query(`
      INSERT INTO clients (
        code_client, nom, prenom, entreprise, email, telephone,
        adresse, ville, pays, type_client, mot_de_passe
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      codeClient, nom, prenom, entreprise, email, telephone,
      adresse, ville, pays, type_client, hashedPassword
    ]);

    // Récupérer le client créé
    const newClient = await query(`
      SELECT 
        id, code_client, nom, prenom, entreprise, email,
        telephone, adresse, ville, pays, type_client, statut,
        date_creation
      FROM clients 
      WHERE id = ?
    `, [result.insertId]);

    // Log de l'action
    await query(`
      INSERT INTO historique_actions (
        user_id, user_type, action, table_concernee, 
        enregistrement_id, nouvelles_valeurs, ip_address
      ) VALUES (?, 'user', 'CREATE', 'clients', ?, ?, ?)
    `, [
      req.user.id, 
      result.insertId, 
      JSON.stringify(newClient[0]),
      req.ip
    ]);

    res.status(201).json({
      success: true,
      message: 'Client créé avec succès',
      data: newClient[0]
    });

  } catch (error) {
    console.error('Erreur création client:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la création du client'
    });
  }
};

// PUT /api/clients/:id - Modifier un client
const updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nom,
      prenom,
      entreprise,
      email,
      telephone,
      adresse,
      ville,
      pays,
      type_client,
      statut
    } = req.body;

    // Vérification si le client existe
    const existingClients = await query(
      'SELECT * FROM clients WHERE id = ?',
      [id]
    );

    if (existingClients.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client introuvable'
      });
    }

    const existingClient = existingClients[0];

    // Vérification si l'email est déjà utilisé par un autre client
    if (email !== existingClient.email) {
      const emailExists = await query(
        'SELECT id FROM clients WHERE email = ? AND id != ?',
        [email, id]
      );

      if (emailExists.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cet email est déjà utilisé par un autre client'
        });
      }
    }

    // Mettre à jour le client
    await query(`
      UPDATE clients SET
        nom = ?, prenom = ?, entreprise = ?, email = ?, telephone = ?,
        adresse = ?, ville = ?, pays = ?, type_client = ?, statut = ?,
        date_modification = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      nom, prenom, entreprise, email, telephone,
      adresse, ville, pays, type_client, statut, id
    ]);

    // Récupérer le client modifié
    const updatedClient = await query(`
      SELECT 
        id, code_client, nom, prenom, entreprise, email,
        telephone, adresse, ville, pays, type_client, statut,
        date_creation, date_modification
      FROM clients 
      WHERE id = ?
    `, [id]);

    // Log de l'action
    await query(`
      INSERT INTO historique_actions (
        user_id, user_type, action, table_concernee, 
        enregistrement_id, anciennes_valeurs, nouvelles_valeurs, ip_address
      ) VALUES (?, 'user', 'UPDATE', 'clients', ?, ?, ?, ?)
    `, [
      req.user.id, 
      id,
      JSON.stringify(existingClient),
      JSON.stringify(updatedClient[0]),
      req.ip
    ]);

    res.json({
      success: true,
      message: 'Client modifié avec succès',
      data: updatedClient[0]
    });

  } catch (error) {
    console.error('Erreur modification client:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la modification du client'
    });
  }
};

// DELETE /api/clients/:id - Supprimer un client
const deleteClient = async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier si le client existe
    const existingClients = await query(
      'SELECT * FROM clients WHERE id = ?',
      [id]
    );

    if (existingClients.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client introuvable'
      });
    }

    const existingClient = existingClients[0];

    // Vérifier s'il y a des factures associées
    const invoices = await query(
      'SELECT COUNT(*) as count FROM factures WHERE client_id = ?',
      [id]
    );

    if (invoices[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer ce client car il a des factures associées'
      });
    }

    // Supprimer le client
    await query('DELETE FROM clients WHERE id = ?', [id]);

    // Log de l'action
    await query(`
      INSERT INTO historique_actions (
        user_id, user_type, action, table_concernee, 
        enregistrement_id, anciennes_valeurs, ip_address
      ) VALUES (?, 'user', 'DELETE', 'clients', ?, ?, ?)
    `, [
      req.user.id, 
      id,
      JSON.stringify(existingClient),
      req.ip
    ]);

    res.json({
      success: true,
      message: 'Client supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur suppression client:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la suppression du client'
    });
  }
};

// GET /api/clients/stats - Statistiques générales des clients
const getClientsStats = async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) as total_clients,
        COUNT(CASE WHEN type_client = 'particulier' THEN 1 END) as particuliers,
        COUNT(CASE WHEN type_client = 'entreprise' THEN 1 END) as entreprises,
        COUNT(CASE WHEN statut = 'actif' THEN 1 END) as actifs,
        COUNT(CASE WHEN statut = 'inactif' THEN 1 END) as inactifs,
        COUNT(CASE WHEN statut = 'suspendu' THEN 1 END) as suspendus,
        COUNT(CASE WHEN DATE(date_creation) = CURDATE() THEN 1 END) as nouveaux_aujourd_hui,
        COUNT(CASE WHEN YEARWEEK(date_creation) = YEARWEEK(CURDATE()) THEN 1 END) as nouveaux_semaine
      FROM clients
    `);

    res.json({
      success: true,
      data: stats[0]
    });

  } catch (error) {
    console.error('Erreur statistiques clients:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des statistiques'
    });
  }
};

// POST /api/clients/:id/toggle-status - Activer/Désactiver un client
const toggleClientStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const clients = await query(
      'SELECT statut FROM clients WHERE id = ?',
      [id]
    );

    if (clients.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client introuvable'
      });
    }

    const currentStatus = clients[0].statut;
    const newStatus = currentStatus === 'actif' ? 'inactif' : 'actif';

    await query(
      'UPDATE clients SET statut = ?, date_modification = CURRENT_TIMESTAMP WHERE id = ?',
      [newStatus, id]
    );

    res.json({
      success: true,
      message: `Client ${newStatus === 'actif' ? 'activé' : 'désactivé'} avec succès`,
      data: { statut: newStatus }
    });

  } catch (error) {
    console.error('Erreur changement statut client:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors du changement de statut'
    });
  }
};

module.exports = {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  getClientsStats,
  toggleClientStatus
};