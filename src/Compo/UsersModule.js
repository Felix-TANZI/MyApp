import React, { useState, useEffect } from 'react';
import './UsersModule.css';

const UsersModule = ({ user }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [stats, setStats] = useState({});
  
  // États pour la recherche et filtrage
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({});
  
  // États pour les modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // État du formulaire
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    pseudo: '',
    email: '',
    role: 'commercial',
    mot_de_passe: '',
    statut: 'actif'
  });

  // État pour changement de rôle
  const [roleData, setRoleData] = useState({
    role: '',
    justification: ''
  });

  // État pour changement de mot de passe
  const [passwordData, setPasswordData] = useState({
    nouveau_mot_de_passe: '',
    confirmer_mot_de_passe: ''
  });

  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, [currentPage, searchTerm, selectedRole, selectedStatus]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage,
        limit: 10,
        search: searchTerm,
        role: selectedRole,
        statut: selectedStatus
      });

      const response = await fetch(`http://localhost:5000/api/users?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors du chargement des utilisateurs');
      }

      const data = await response.json();
      setUsers(data.data.users);
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
      const response = await fetch('http://localhost:5000/api/users/stats', {
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

  const handleCreateUser = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/users', {
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

      await fetchUsers();
      await fetchStats();
      setShowCreateModal(false);
      resetForm();
      setSuccess('Utilisateur créé avec succès');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = async () => {
    try {
      setLoading(true);
      const { mot_de_passe, ...updateData } = formData; // Exclure le mot de passe
      
      const response = await fetch(`http://localhost:5000/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }

      await fetchUsers();
      await fetchStats();
      setShowEditModal(false);
      setSelectedUser(null);
      resetForm();
      setSuccess('Utilisateur modifié avec succès');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeRole = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/users/${selectedUser.id}/role`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(roleData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }

      await fetchUsers();
      await fetchStats();
      setShowRoleModal(false);
      setSelectedUser(null);
      setRoleData({ role: '', justification: '' });
      setSuccess('Rôle modifié avec succès');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      if (passwordData.nouveau_mot_de_passe !== passwordData.confirmer_mot_de_passe) {
        setError('Les mots de passe ne correspondent pas');
        return;
      }

      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/users/${selectedUser.id}/password`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ nouveau_mot_de_passe: passwordData.nouveau_mot_de_passe })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }

      setShowPasswordModal(false);
      setSelectedUser(null);
      setPasswordData({ nouveau_mot_de_passe: '', confirmer_mot_de_passe: '' });
      setSuccess('Mot de passe modifié avec succès');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (targetUser) => {
    try {
      const response = await fetch(`http://localhost:5000/api/users/${targetUser.id}/toggle-status`, {
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

      await fetchUsers();
      await fetchStats();
      setSuccess(`Utilisateur ${targetUser.statut === 'actif' ? 'désactivé' : 'activé'} avec succès`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/users/${selectedUser.id}`, {
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

      await fetchUsers();
      await fetchStats();
      setShowDeleteModal(false);
      setSelectedUser(null);
      setSuccess('Utilisateur supprimé avec succès');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      nom: '',
      prenom: '',
      pseudo: '',
      email: '',
      role: 'commercial',
      mot_de_passe: '',
      statut: 'actif'
    });
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (targetUser) => {
    setSelectedUser(targetUser);
    setFormData({
      nom: targetUser.nom,
      prenom: targetUser.prenom,
      pseudo: targetUser.pseudo,
      email: targetUser.email,
      role: targetUser.role,
      mot_de_passe: '', // Toujours vide pour l'édition
      statut: targetUser.statut
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (targetUser) => {
    setSelectedUser(targetUser);
    setShowDeleteModal(true);
  };

  const openRoleModal = (targetUser) => {
    setSelectedUser(targetUser);
    setRoleData({
      role: targetUser.role,
      justification: ''
    });
    setShowRoleModal(true);
  };

  const openPasswordModal = (targetUser) => {
    setSelectedUser(targetUser);
    setPasswordData({
      nouveau_mot_de_passe: '',
      confirmer_mot_de_passe: ''
    });
    setShowPasswordModal(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Jamais';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRoleBadge = (role) => {
    const badges = {
      'admin': { class: 'admin', text: 'Admin', icon: '👑' },
      'commercial': { class: 'commercial', text: 'Commercial', icon: '💼' },
      'comptable': { class: 'comptable', text: 'Comptable', icon: '📊' }
    };
    return badges[role] || badges.commercial;
  };

  const getStatusBadge = (status) => {
    const badges = {
      'actif': { class: 'actif', text: 'Actif', icon: '✅' },
      'inactif': { class: 'inactif', text: 'Inactif', icon: '⏸️' },
      'suspendu': { class: 'suspendu', text: 'Suspendu', icon: '🚫' }
    };
    return badges[status] || badges.actif;
  };

  const getConnectionStatus = (dateString) => {
    if (!dateString) return 'old';
    const lastConnection = new Date(dateString);
    const now = new Date();
    const diffHours = (now - lastConnection) / (1000 * 60 * 60);
    
    if (diffHours < 24) return 'recent';
    if (diffHours < 168) return 'moderate'; // 1 semaine
    return 'old';
  };

  const canManageUser = (targetUser) => {
    // Empêcher l'auto-gestion
    if (user.id === targetUser.id) return false;
    // Seul admin peut gérer
    return user.role === 'admin';
  };

  return (
    <div className="users-module">
      {/* En-tête avec statistiques */}
      <div className="module-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Gestion des Utilisateurs</h1>
            <p>Administration du personnel système</p>
          </div>
          <button className="btn-primary" onClick={openCreateModal}>
            <span className="btn-icon">➕</span>
            Nouvel Utilisateur
          </button>
        </div>
        
        <div className="stats-cards">
          <div className="stat-card red">
            <div className="stat-icon">👥</div>
            <div className="stat-content">
              <h3>{stats.total_users || 0}</h3>
              <p>Total Utilisateurs</p>
            </div>
          </div>
          <div className="stat-card blue">
            <div className="stat-icon">👑</div>
            <div className="stat-content">
              <h3>{stats.admins || 0}</h3>
              <p>Administrateurs</p>
            </div>
          </div>
          <div className="stat-card green">
            <div className="stat-icon">✅</div>
            <div className="stat-content">
              <h3>{stats.actifs || 0}</h3>
              <p>Utilisateurs Actifs</p>
            </div>
          </div>
          <div className="stat-card orange">
            <div className="stat-icon">📈</div>
            <div className="stat-content">
              <h3>{stats.nouveaux_mois || 0}</h3>
              <p>Nouveaux ce Mois</p>
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
            placeholder="Rechercher un utilisateur..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="filters">
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
          >
            <option value="">Tous les rôles</option>
            <option value="admin">Administrateurs</option>
            <option value="commercial">Commerciaux</option>
            <option value="comptable">Comptables</option>
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

      {/* Messages */}
      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      {success && (
        <div className="success-message">
          <span className="success-icon">✅</span>
          {success}
        </div>
      )}

      {/* Table des utilisateurs */}
      <div className="users-table-container">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Chargement des utilisateurs...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h3>Aucun utilisateur trouvé</h3>
            <p>Commencez par ajouter votre premier utilisateur</p>
            <button className="btn-primary" onClick={openCreateModal}>
              <span className="btn-icon">➕</span>
              Ajouter un utilisateur
            </button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Matricule</th>
                  <th>Nom & Prénom</th>
                  <th>Contact</th>
                  <th>Rôle</th>
                  <th>Statut</th>
                  <th>Dernière connexion</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((targetUser) => (
                  <tr key={targetUser.id}>
                    <td>
                      <div className="user-matricule">
                        <span className="matricule">{targetUser.matricule}</span>
                      </div>
                    </td>
                    <td>
                      <div className="user-name">
                        <strong>{targetUser.nom} {targetUser.prenom}</strong>
                        <div className="pseudo">@{targetUser.pseudo}</div>
                      </div>
                    </td>
                    <td>
                      <div className="user-contact">
                        <div className="email">{targetUser.email}</div>
                      </div>
                    </td>
                    <td>
                      <span className={`role-badge ${getRoleBadge(targetUser.role).class}`}>
                        {getRoleBadge(targetUser.role).icon} {getRoleBadge(targetUser.role).text}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${getStatusBadge(targetUser.statut).class}`}>
                        {getStatusBadge(targetUser.statut).icon} {getStatusBadge(targetUser.statut).text}
                      </span>
                    </td>
                    <td>
                      <div className={`last-connection ${getConnectionStatus(targetUser.derniere_connexion)}`}>
                        {formatDate(targetUser.derniere_connexion)}
                      </div>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="btn-icon-action view"
                          title="Voir les détails"
                        >
                          👁️
                        </button>
                        {canManageUser(targetUser) && (
                          <>
                            <button 
                              className="btn-icon-action edit"
                              onClick={() => openEditModal(targetUser)}
                              title="Modifier"
                            >
                              ✏️
                            </button>
                            <button 
                              className="btn-icon-action password"
                              onClick={() => openPasswordModal(targetUser)}
                              title="Changer mot de passe"
                            >
                              🔑
                            </button>
                            <button 
                              className="btn-icon-action role"
                              onClick={() => openRoleModal(targetUser)}
                              title="Changer rôle"
                            >
                              🔄
                            </button>
                            <button 
                              className="btn-icon-action toggle"
                              onClick={() => handleToggleStatus(targetUser)}
                              title={targetUser.statut === 'actif' ? 'Désactiver' : 'Activer'}
                            >
                              {targetUser.statut === 'actif' ? '⏸️' : '▶️'}
                            </button>
                            <button 
                              className="btn-icon-action delete"
                              onClick={() => openDeleteModal(targetUser)}
                              title="Supprimer"
                            >
                              🗑️
                            </button>
                          </>
                        )}
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
            ({pagination.total} utilisateurs)
          </span>
          <button 
            disabled={!pagination.hasNext}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Suivant →
          </button>
        </div>
      )}

      {/* Modales */}
      {showCreateModal && (
        <UserFormModal
          title="Nouvel Utilisateur"
          formData={formData}
          onChange={handleFormChange}
          onSubmit={handleCreateUser}
          onClose={() => setShowCreateModal(false)}
          loading={loading}
          isEdit={false}
        />
      )}

      {showEditModal && (
        <UserFormModal
          title="Modifier Utilisateur"
          formData={formData}
          onChange={handleFormChange}
          onSubmit={handleEditUser}
          onClose={() => {
            setShowEditModal(false);
            setSelectedUser(null);
            resetForm();
          }}
          loading={loading}
          isEdit={true}
        />
      )}

      {showRoleModal && (
        <RoleChangeModal
          user={selectedUser}
          roleData={roleData}
          onRoleChange={setRoleData}
          onConfirm={handleChangeRole}
          onClose={() => {
            setShowRoleModal(false);
            setSelectedUser(null);
            setRoleData({ role: '', justification: '' });
          }}
          loading={loading}
        />
      )}

      {showPasswordModal && (
        <PasswordChangeModal
          user={selectedUser}
          passwordData={passwordData}
          onPasswordChange={setPasswordData}
          onConfirm={handleChangePassword}
          onClose={() => {
            setShowPasswordModal(false);
            setSelectedUser(null);
            setPasswordData({ nouveau_mot_de_passe: '', confirmer_mot_de_passe: '' });
          }}
          loading={loading}
        />
      )}

      {showDeleteModal && (
        <DeleteUserModal
          user={selectedUser}
          onConfirm={handleDeleteUser}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedUser(null);
          }}
          loading={loading}
        />
      )}
    </div>
  );
};

// Composant Modal de formulaire utilisateur
const UserFormModal = ({ 
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
          <h3>
            <span>{isEdit ? '✏️' : '➕'}</span>
            {title}
          </h3>
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
              <label htmlFor="prenom">Prénom *</label>
              <input
                type="text"
                id="prenom"
                name="prenom"
                value={formData.prenom}
                onChange={onChange}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="pseudo">Pseudo *</label>
              <input
                type="text"
                id="pseudo"
                name="pseudo"
                value={formData.pseudo}
                onChange={onChange}
                required
              />
              <small>Identifiant unique de connexion</small>
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
              <label htmlFor="role">Rôle *</label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={onChange}
                required
                disabled={isEdit} // Le rôle ne peut pas être modifié via ce formulaire
              >
                <option value="admin">👑 Administrateur</option>
                <option value="commercial">💼 Commercial</option>
                <option value="comptable">📊 Comptable</option>
              </select>
              {isEdit && (
                <small>Utilisez "Changer rôle" pour modifier le rôle</small>
              )}
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
                  <option value="actif">✅ Actif</option>
                  <option value="inactif">⏸️ Inactif</option>
                  <option value="suspendu">🚫 Suspendu</option>
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

          {!isEdit && (
            <div className="info-text">
              ℹ️ Le matricule sera généré automatiquement selon le rôle sélectionné
            </div>
          )}
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
            {loading ? 'Enregistrement...' : (isEdit ? '✏️ Modifier' : '➕ Créer')}
          </button>
        </div>
      </div>
    </div>
  );
};

// Composant Modal de changement de rôle
const RoleChangeModal = ({ user, roleData, onRoleChange, onConfirm, onClose, loading }) => {
  const roles = [
    { 
      value: 'admin', 
      label: 'Administrateur', 
      icon: '👑',
      description: 'Accès complet au système, gestion des utilisateurs'
    },
    { 
      value: 'commercial', 
      label: 'Commercial', 
      icon: '💼',
      description: 'Gestion clients et factures, pas d\'administration'
    },
    { 
      value: 'comptable', 
      label: 'Comptable', 
      icon: '📊',
      description: 'Consultation et validation des paiements'
    }
  ];

  const handleRoleSelect = (role) => {
    onRoleChange(prev => ({ ...prev, role }));
  };

  const handleJustificationChange = (e) => {
    onRoleChange(prev => ({ ...prev, justification: e.target.value }));
  };

  return (
    <div className="modal-overlay">
      <div className="modal role-modal">
        <div className="modal-header">
          <h3>
            <span>🔄</span>
            Changer le rôle - {user?.nom} {user?.prenom}
          </h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="info-text">
            ⚠️ Attention : Changer le rôle modifiera également le matricule de l'utilisateur
          </div>

          <div className="role-options">
            {roles.map(role => (
              <div
                key={role.value}
                className={`role-option ${roleData.role === role.value ? 'selected' : ''}`}
                onClick={() => handleRoleSelect(role.value)}
              >
                <div className={`role-option-icon ${role.value}`}>
                  {role.icon}
                </div>
                <div className="role-option-content">
                  <h4>{role.label}</h4>
                  <p>{role.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="justification-field">
            <label htmlFor="justification">Justification du changement *</label>
            <textarea
              id="justification"
              placeholder="Expliquez pourquoi ce changement de rôle est nécessaire..."
              value={roleData.justification}
              onChange={handleJustificationChange}
              required
            />
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            className="btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Annuler
          </button>
          <button 
            className="btn-primary"
            onClick={onConfirm}
            disabled={loading || !roleData.role || !roleData.justification.trim()}
          >
            {loading ? 'Mise à jour...' : '🔄 Changer le rôle'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Composant Modal de changement de mot de passe
const PasswordChangeModal = ({ user, passwordData, onPasswordChange, onConfirm, onClose, loading }) => {
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    onPasswordChange(prev => ({ ...prev, [name]: value }));
  };

  const passwordsMatch = passwordData.nouveau_mot_de_passe === passwordData.confirmer_mot_de_passe;
  const isValidPassword = passwordData.nouveau_mot_de_passe.length >= 6;

  return (
    <div className="modal-overlay">
      <div className="modal password-modal">
        <div className="modal-header">
          <h3>
            <span>🔑</span>
            Changer le mot de passe - {user?.nom} {user?.prenom}
          </h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="info-text">
            🔒 L'utilisateur devra utiliser ce nouveau mot de passe lors de sa prochaine connexion
          </div>

          <div className="form-grid">
            <div className="form-group full-width">
              <label htmlFor="nouveau_mot_de_passe">Nouveau mot de passe *</label>
              <input
                type="password"
                id="nouveau_mot_de_passe"
                name="nouveau_mot_de_passe"
                value={passwordData.nouveau_mot_de_passe}
                onChange={handleInputChange}
                minLength="6"
                required
              />
              <small>Minimum 6 caractères</small>
            </div>
            
            <div className="form-group full-width">
              <label htmlFor="confirmer_mot_de_passe">Confirmer le mot de passe *</label>
              <input
                type="password"
                id="confirmer_mot_de_passe"
                name="confirmer_mot_de_passe"
                value={passwordData.confirmer_mot_de_passe}
                onChange={handleInputChange}
                required
              />
              {passwordData.confirmer_mot_de_passe && !passwordsMatch && (
                <small style={{ color: '#dc2626' }}>Les mots de passe ne correspondent pas</small>
              )}
              {passwordData.confirmer_mot_de_passe && passwordsMatch && (
                <small style={{ color: '#059669' }}>✅ Les mots de passe correspondent</small>
              )}
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            className="btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Annuler
          </button>
          <button 
            className="btn-primary"
            onClick={onConfirm}
            disabled={loading || !isValidPassword || !passwordsMatch}
          >
            {loading ? 'Mise à jour...' : '🔑 Changer le mot de passe'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Composant Modal de suppression
const DeleteUserModal = ({ user, onConfirm, onClose, loading }) => (
  <div className="modal-overlay">
    <div className="modal delete-modal">
      <div className="modal-header">
        <h3>
          <span>🗑️</span>
          Supprimer l'utilisateur
        </h3>
      </div>
      <div className="modal-body">
        <p>
          Êtes-vous sûr de vouloir supprimer l'utilisateur{' '}
          <strong>{user?.nom} {user?.prenom}</strong> ({user?.matricule}) ?
        </p>
        <div className="warning-text">
          ⚠️ Cette action peut être irréversible selon les données liées à cet utilisateur.
          Si l'utilisateur a créé des factures ou effectué des actions importantes,
          son compte sera désactivé au lieu d'être supprimé.
        </div>
      </div>
      <div className="modal-footer">
        <button 
          className="btn-secondary"
          onClick={onClose}
          disabled={loading}
        >
          Annuler
        </button>
        <button 
          className="btn-danger"
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? 'Suppression...' : '🗑️ Supprimer'}
        </button>
      </div>
    </div>
  </div>
);

export default UsersModule;