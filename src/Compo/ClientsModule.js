import React, { useState, useEffect } from 'react';
import './ClientsModule.css';

const ClientsModule = ({ user }) => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({});
  
  // États pour la recherche et filtrage
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({});
  
  // États pour les modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  
  // État du formulaire
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    entreprise: '',
    email: '',
    telephone: '',
    adresse: '',
    ville: 'Yaoundé',
    pays: 'Cameroun',
    type_client: 'particulier',
    mot_de_passe: ''
  });

  useEffect(() => {
    fetchClients();
    fetchStats();
  }, [currentPage, searchTerm, selectedType, selectedStatus]);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage,
        limit: 10,
        search: searchTerm,
        type: selectedType,
        statut: selectedStatus
      });

      const response = await fetch(`http://localhost:5000/api/clients?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors du chargement des clients');
      }

      const data = await response.json();
      setClients(data.data.clients);
      setPagination(data.data.pagination);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Erreur:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/clients/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }
    } catch (err) {
      console.error('Erreur stats:', err);
    }
  };

  const handleCreateClient = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/clients', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }

      await fetchClients();
      await fetchStats();
      setShowCreateModal(false);
      resetForm();
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClient = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/clients/${selectedClient.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          mot_de_passe: undefined // Ne MDP n'est pas inclut dans l'édition
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }

      await fetchClients();
      await fetchStats();
      setShowEditModal(false);
      setSelectedClient(null);
      resetForm();
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClient = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/clients/${selectedClient.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }

      await fetchClients();
      await fetchStats();
      setShowDeleteModal(false);
      setSelectedClient(null);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (client) => {
    try {
      const response = await fetch(`http://localhost:5000/api/clients/${client.id}/toggle-status`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }

      await fetchClients();
      await fetchStats();
    } catch (err) {
      setError(err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      nom: '',
      prenom: '',
      entreprise: '',
      email: '',
      telephone: '',
      adresse: '',
      ville: 'Yaoundé',
      pays: 'Cameroun',
      type_client: 'particulier',
      mot_de_passe: ''
    });
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (client) => {
    setSelectedClient(client);
    setFormData({
      nom: client.nom,
      prenom: client.prenom || '',
      entreprise: client.entreprise || '',
      email: client.email,
      telephone: client.telephone || '',
      adresse: client.adresse || '',
      ville: client.ville,
      pays: client.pays,
      type_client: client.type_client,
      statut: client.statut
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (client) => {
    setSelectedClient(client);
    setShowDeleteModal(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      'actif': { class: 'success', text: 'Actif', icon: '✅' },
      'inactif': { class: 'warning', text: 'Inactif', icon: '⏸️' },
      'suspendu': { class: 'danger', text: 'Suspendu', icon: '🚫' }
    };
    return badges[status] || badges.actif;
  };

  const getTypeBadge = (type) => {
    const badges = {
      'particulier': { class: 'info', text: 'Particulier', icon: '👤' },
      'entreprise': { class: 'primary', text: 'Entreprise', icon: '🏢' }
    };
    return badges[type] || badges.particulier;
  };

  return (
    <div className="clients-module">
      {/* En-tête avec statistiques */}
      <div className="module-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Gestion des Clients</h1>
            <p>Gérer les clients de votre établissement avec Amani</p>
          </div>
          <button className="btn-primary" onClick={openCreateModal}>
            <span className="btn-icon">➕</span>
            Nouveau Client
          </button>
        </div>
        
        <div className="stats-cards">
          <div className="stat-card blue">
            <div className="stat-icon">👥</div>
            <div className="stat-content">
              <h3>{stats.total_clients || 0}</h3>
              <p>Total Clients</p>
            </div>
          </div>
          <div className="stat-card green">
            <div className="stat-icon">✅</div>
            <div className="stat-content">
              <h3>{stats.actifs || 0}</h3>
              <p>Clients Actifs</p>
            </div>
          </div>
          <div className="stat-card purple">
            <div className="stat-icon">🏢</div>
            <div className="stat-content">
              <h3>{stats.entreprises || 0}</h3>
              <p>Entreprises</p>
            </div>
          </div>
          <div className="stat-card orange">
            <div className="stat-icon">👤</div>
            <div className="stat-content">
              <h3>{stats.particuliers || 0}</h3>
              <p>Particuliers</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtres et recherche */}
      <div className="filters-section">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Rechercher un client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="filters">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <option value="">Tous les types</option>
            <option value="particulier">Particuliers</option>
            <option value="entreprise">Entreprises</option>
          </select>
          
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="">Tous les statuts</option>
            <option value="actif">Actifs</option>
            <option value="inactif">Inactifs</option>
            <option value="suspendu">Suspendus</option>
          </select>
        </div>
      </div>

      {/* Messages d'erreur */}
      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      {/* Table des clients */}
      <div className="clients-table-container">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Chargement des clients...</p>
          </div>
        ) : clients.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h3>Aucun client trouvé</h3>
            <p>Commencez par ajouter votre premier client</p>
            <button className="btn-primary" onClick={openCreateModal}>
              <span className="btn-icon">➕</span>
              Ajouter un client
            </button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="clients-table">
              <thead>
                <tr>
                  <th>Code Client</th>
                  <th>Nom & Prénom</th>
                  <th>Contact</th>
                  <th>Type</th>
                  <th>Statut</th>
                  <th>Date création</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <div className="client-code">
                        <span className="code">{client.code_client}</span>
                      </div>
                    </td>
                    <td>
                      <div className="client-name">
                        <strong>{client.nom} {client.prenom}</strong>
                        {client.entreprise && (
                          <div className="company">{client.entreprise}</div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="client-contact">
                        <div className="email">{client.email}</div>
                        {client.telephone && (
                          <div className="phone">{client.telephone}</div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${getTypeBadge(client.type_client).class}`}>
                        {getTypeBadge(client.type_client).icon} {getTypeBadge(client.type_client).text}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadge(client.statut).class}`}>
                        {getStatusBadge(client.statut).icon} {getStatusBadge(client.statut).text}
                      </span>
                    </td>
                    <td>{formatDate(client.date_creation)}</td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="btn-icon-action view"
                          title="Voir les détails"
                        >
                          👁️
                        </button>
                        <button 
                          className="btn-icon-action edit"
                          onClick={() => openEditModal(client)}
                          title="Modifier"
                        >
                          ✏️
                        </button>
                        <button 
                          className={`btn-icon-action ${client.statut === 'actif' ? 'warning' : 'success'}`}
                          onClick={() => handleToggleStatus(client)}
                          title={client.statut === 'actif' ? 'Désactiver' : 'Activer'}
                        >
                          {client.statut === 'actif' ? '⏸️' : '▶️'}
                        </button>
                        <button 
                          className="btn-icon-action danger"
                          onClick={() => openDeleteModal(client)}
                          title="Supprimer"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="pagination">
          <button 
            disabled={!pagination.hasPrev}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            ← Précédent
          </button>
          <span className="page-info">
            Page {pagination.page} sur {pagination.totalPages} 
            ({pagination.total} clients)
          </span>
          <button 
            disabled={!pagination.hasNext}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Suivant →
          </button>
        </div>
      )}

      {/* Modal de création */}
      {showCreateModal && (
        <ClientFormModal
          title="Nouveau Client"
          formData={formData}
          onChange={handleFormChange}
          onSubmit={handleCreateClient}
          onClose={() => setShowCreateModal(false)}
          loading={loading}
          isEdit={false}
        />
      )}

      {/* Modal d'édition */}
      {showEditModal && (
        <ClientFormModal
          title="Modifier Client"
          formData={formData}
          onChange={handleFormChange}
          onSubmit={handleEditClient}
          onClose={() => setShowEditModal(false)}
          loading={loading}
          isEdit={true}
        />
      )}

      {/* Modal de suppression */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal delete-modal">
            <div className="modal-header">
              <h3>🗑️ Supprimer le client</h3>
            </div>
            <div className="modal-body">
              <p>
                Êtes-vous sûr de vouloir supprimer le client{' '}
                <strong>{selectedClient?.nom} {selectedClient?.prenom}</strong> ?
              </p>
              <p className="warning-text">
                ⚠️ Cette action est irréversible et ne peut être effectuée que si 
                le client n'a aucune facture associée.
              </p>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={() => setShowDeleteModal(false)}
                disabled={loading}
              >
                Annuler
              </button>
              <button 
                className="btn-danger"
                onClick={handleDeleteClient}
                disabled={loading}
              >
                {loading ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Composant de formulaire modal réutilisable
const ClientFormModal = ({ 
  title, 
  formData, 
  onChange, 
  onSubmit, 
  onClose, 
  loading, 
  isEdit 
}) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <div className="modal-overlay">
      <div className="modal form-modal">
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="nom">Nom *</label>
              <input
                type="text"
                id="nom"
                name="nom"
                value={formData.nom}
                onChange={onChange}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="prenom">Prénom</label>
              <input
                type="text"
                id="prenom"
                name="prenom"
                value={formData.prenom}
                onChange={onChange}
              />
            </div>
            
            <div className="form-group full-width">
              <label htmlFor="entreprise">Entreprise</label>
              <input
                type="text"
                id="entreprise"
                name="entreprise"
                value={formData.entreprise}
                onChange={onChange}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="email">Email *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={onChange}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="telephone">Téléphone</label>
              <input
                type="tel"
                id="telephone"
                name="telephone"
                value={formData.telephone}
                onChange={onChange}
              />
            </div>
            
            <div className="form-group full-width">
              <label htmlFor="adresse">Adresse</label>
              <textarea
                id="adresse"
                name="adresse"
                value={formData.adresse}
                onChange={onChange}
                rows="3"
              ></textarea>
            </div>
            
            <div className="form-group">
              <label htmlFor="ville">Ville</label>
              <input
                type="text"
                id="ville"
                name="ville"
                value={formData.ville}
                onChange={onChange}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="pays">Pays</label>
              <input
                type="text"
                id="pays"
                name="pays"
                value={formData.pays}
                onChange={onChange}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="type_client">Type de client</label>
              <select
                id="type_client"
                name="type_client"
                value={formData.type_client}
                onChange={onChange}
                required
              >
                <option value="particulier">Particulier</option>
                <option value="entreprise">Entreprise</option>
              </select>
            </div>
            
            {isEdit && (
              <div className="form-group">
                <label htmlFor="statut">Statut</label>
                <select
                  id="statut"
                  name="statut"
                  value={formData.statut}
                  onChange={onChange}
                >
                  <option value="actif">Actif</option>
                  <option value="inactif">Inactif</option>
                  <option value="suspendu">Suspendu</option>
                </select>
              </div>
            )}
            
            {!isEdit && (
              <div className="form-group full-width">
                <label htmlFor="mot_de_passe">Mot de passe *</label>
                <input
                  type="password"
                  id="mot_de_passe"
                  name="mot_de_passe"
                  value={formData.mot_de_passe}
                  onChange={onChange}
                  required
                  minLength="6"
                />
                <small>Minimum 6 caractères</small>
              </div>
            )}
          </div>
        </form>
        
        <div className="modal-footer">
          <button 
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Annuler
          </button>
          <button 
            type="submit"
            className="btn-primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Enregistrement...' : (isEdit ? 'Modifier' : 'Créer')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClientsModule;