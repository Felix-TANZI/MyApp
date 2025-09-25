import React, { useState, useEffect, useCallback } from 'react';
import './AdminRequestsModule.css';

const AdminRequestsModule = ({ user }) => {
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({
    demandes_profil: 0,
    demandes_mot_de_passe: 0,
    total_demandes: 0,
    demandes_profil_24h: 0,
    demandes_password_24h: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [actionType, setActionType] = useState(null); // 'approve' | 'reject'
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  
  // Filtres et pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    type: 'all', // 'all' | 'modification_profil' | 'changement_mot_de_passe'
    urgency: 'all', // 'all' | 'urgent' | 'moderee' | 'normale'
    search: ''
  });

  // Charger les demandes
  const loadRequests = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      });
      
      if (filters.type !== 'all') {
        params.append('type', filters.type);
      }
      
      if (filters.search) {
        params.append('search', filters.search);
      }

      const response = await fetch(`http://localhost:5000/api/requests?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setRequests(data.data.requests || []);
        setStats(data.data.stats || {});
        setCurrentPage(data.data.pagination.page);
        setTotalPages(data.data.pagination.totalPages);
      } else {
        throw new Error(data.message || 'Erreur lors du chargement');
      }

    } catch (error) {
      console.error('Erreur chargement demandes:', error);
      setError(error.message);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Charger les statistiques détaillées
  const loadStats = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5000/api/requests/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStats(data.data.global || {});
        }
      }
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    }
  }, []);

  // Effet pour charger les données au montage et lors des changements de filtres
  useEffect(() => {
    loadRequests(1);
    loadStats();
  }, [loadRequests, loadStats]);

  // Gérer les changements de filtres
  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setCurrentPage(1);
  };

  // Gérer la pagination
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      loadRequests(newPage);
    }
  };

  // Ouvrir le modal d'action
  const openActionModal = (request, action) => {
    setSelectedRequest(request);
    setActionType(action);
    setRejectionReason('');
    setShowModal(true);
  };

  // Fermer le modal
  const closeModal = () => {
    setShowModal(false);
    setSelectedRequest(null);
    setActionType(null);
    setRejectionReason('');
    setProcessing(false);
  };

  // Traiter une demande (approuver/rejeter)
  const processRequest = async () => {
    if (!selectedRequest || !actionType) return;

    try {
      setProcessing(true);
      setError(null);

      const isProfileRequest = selectedRequest.type_demande === 'modification_profil';
      const action = actionType === 'approve' ? 'approve' : 'reject';
      const endpoint = isProfileRequest ? 
        `${action}-profile` : 
        `${action}-password`;

      const requestBody = actionType === 'reject' && rejectionReason ? 
        { motif: rejectionReason } : {};

      const response = await fetch(
        `http://localhost:5000/api/requests/${selectedRequest.id}/${endpoint}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        }
      );

      const data = await response.json();

      if (data.success) {
        // Recharger la liste des demandes
        await loadRequests(currentPage);
        await loadStats();
        
        // Fermer le modal
        closeModal();
        
        // Message de succès
        const actionText = actionType === 'approve' ? 'approuvée' : 'rejetée';
        const requestText = isProfileRequest ? 'modification de profil' : 'changement de mot de passe';
        alert(`Demande de ${requestText} ${actionText} avec succès`);
        
      } else {
        throw new Error(data.message || 'Erreur lors du traitement');
      }

    } catch (error) {
      console.error('Erreur traitement demande:', error);
      setError(error.message);
    } finally {
      setProcessing(false);
    }
  };

  // Fonction utilitaire pour formater les dates
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Fonction pour obtenir le badge d'urgence
  const getUrgencyBadge = (urgency) => {
    const badges = {
      urgent: { class: 'urgent', text: 'Urgent', icon: '🔥' },
      moderee: { class: 'moderate', text: 'Modérée', icon: '⚡' },
      normale: { class: 'normal', text: 'Normale', icon: '📝' }
    };
    
    const badge = badges[urgency] || badges.normale;
    return (
      <span className={`urgency-badge ${badge.class}`}>
        <span className="urgency-icon">{badge.icon}</span>
        {badge.text}
      </span>
    );
  };

  // Fonction pour obtenir l'icône du type de demande
  const getRequestTypeIcon = (type) => {
    return type === 'modification_profil' ? '👤' : '🔐';
  };

  // Fonction pour formater le nom du client
  const getClientDisplayName = (request) => {
    if (request.entreprise) {
      return `${request.entreprise} (${request.prenom} ${request.nom})`;
    }
    return `${request.prenom} ${request.nom}`;
  };

  if (loading && requests.length === 0) {
    return (
      <div className="admin-requests-loading">
        <div className="loading-spinner"></div>
        <p>Chargement des demandes...</p>
      </div>
    );
  }

  return (
    <div className="admin-requests-module">
      {/* Header avec statistiques */}
      <div className="requests-header">
        <div className="header-info">
          <h2>Gestion des Demandes Clients</h2>
          <p className="header-description">
            Gérez les demandes de modification de profil et de changement de mot de passe
          </p>
        </div>
        
        <div className="stats-cards">
          <div className="stat-card total">
            <div className="stat-icon">📋</div>
            <div className="stat-content">
              <span className="stat-value">{stats.total_demandes || 0}</span>
              <span className="stat-label">Total en attente</span>
            </div>
          </div>
          
          <div className="stat-card profile">
            <div className="stat-icon">👤</div>
            <div className="stat-content">
              <span className="stat-value">{stats.demandes_profil || 0}</span>
              <span className="stat-label">Modifications profil</span>
            </div>
          </div>
          
          <div className="stat-card password">
            <div className="stat-icon">🔐</div>
            <div className="stat-content">
              <span className="stat-value">{stats.demandes_mot_de_passe || 0}</span>
              <span className="stat-label">Changements mot de passe</span>
            </div>
          </div>
          
          <div className="stat-card recent">
            <div className="stat-icon">🕒</div>
            <div className="stat-content">
              <span className="stat-value">
                {(stats.demandes_profil_24h || 0) + (stats.demandes_password_24h || 0)}
              </span>
              <span className="stat-label">Dernières 24h</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="requests-filters">
        <div className="filter-group">
          <label>Type de demande</label>
          <select 
            value={filters.type} 
            onChange={(e) => handleFilterChange({ type: e.target.value })}
          >
            <option value="all">Toutes les demandes</option>
            <option value="modification_profil">Modifications profil</option>
            <option value="changement_mot_de_passe">Changements mot de passe</option>
          </select>
        </div>
        
        <div className="filter-group">
          <label>Recherche client</label>
          <input
            type="text"
            placeholder="Nom, entreprise, email..."
            value={filters.search}
            onChange={(e) => handleFilterChange({ search: e.target.value })}
          />
        </div>
        
        <button 
          className="refresh-btn"
          onClick={() => loadRequests(currentPage)}
          disabled={loading}
        >
          🔄 Actualiser
        </button>
      </div>

      {/* Messages d'erreur */}
      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Liste des demandes */}
      <div className="requests-list">
        {requests.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3>Aucune demande en attente</h3>
            <p>
              {filters.type !== 'all' || filters.search ? 
                'Aucune demande ne correspond aux filtres sélectionnés.' :
                'Toutes les demandes ont été traitées !'
              }
            </p>
          </div>
        ) : (
          <>
            {requests.map((request) => (
              <div key={request.id} className={`request-card ${request.urgency}`}>
                <div className="request-header">
                  <div className="request-type">
                    <span className="type-icon">
                      {getRequestTypeIcon(request.type_demande)}
                    </span>
                    <span className="type-text">
                      {request.type_demande === 'modification_profil' ? 
                        'Modification Profil' : 
                        'Changement Mot de Passe'
                      }
                    </span>
                  </div>
                  
                  {getUrgencyBadge(request.urgency)}
                </div>
                
                <div className="request-content">
                  <div className="client-info">
                    <h4>{getClientDisplayName(request)}</h4>
                    <div className="client-details">
                      <span className="client-code">{request.code_client}</span>
                      <span className="client-email">{request.email}</span>
                      <span className="client-type">
                        {request.type_client === 'entreprise' ? 'Entreprise' : 'Particulier'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="request-meta">
                    <div className="request-date">
                      <span className="meta-label">Demandé le:</span>
                      <span className="meta-value">{formatDate(request.date_demande)}</span>
                    </div>
                    
                    {request.creator_nom && (
                      <div className="request-creator">
                        <span className="meta-label">Créé par:</span>
                        <span className="meta-value">
                          {request.creator_prenom} {request.creator_nom} ({request.creator_role})
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Détails des modifications demandées */}
{request.modification_details && request.current_values && (
  <div className="modification-details">
    <h5>Modifications demandées:</h5>
    <div className="changes-comparison">
      {Object.entries(request.modification_details).map(([key, newValue]) => {
        const currentValue = request.current_values[key] || '';
        const hasChanged = currentValue !== newValue;
        
        if (!hasChanged) return null;
        
        return (
          <div key={key} className="change-comparison-item">
            <div className="field-name">
              {key === 'nom' ? 'Nom' :
               key === 'prenom' ? 'Prénom' :
               key === 'telephone' ? 'Téléphone' :
               key === 'adresse' ? 'Adresse' :
               key === 'ville' ? 'Ville' :
               key === 'pays' ? 'Pays' : key}:
            </div>
            <div className="value-comparison">
              <div className="value-before">
                <span className="label">Avant:</span>
                <span className="value">{currentValue || 'Non renseigné'}</span>
              </div>
              <div className="arrow">→</div>
              <div className="value-after">
                <span className="label">Après:</span>
                <span className="value">{newValue || 'Non renseigné'}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
)}
                </div>
                
                <div className="request-actions">
                  <button
                    className="action-btn approve"
                    onClick={() => openActionModal(request, 'approve')}
                    disabled={processing}
                  >
                    <span className="btn-icon">✅</span>
                    <span>Approuver</span>
                  </button>
                  
                  <button
                    className="action-btn reject"
                    onClick={() => openActionModal(request, 'reject')}
                    disabled={processing}
                  >
                    <span className="btn-icon">❌</span>
                    <span>Rejeter</span>
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="pagination-btn"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || loading}
          >
            ← Précédent
          </button>
          
          <div className="pagination-info">
            <span>Page {currentPage} sur {totalPages}</span>
          </div>
          
          <button
            className="pagination-btn"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || loading}
          >
            Suivant →
          </button>
        </div>
      )}

      {/* Modal d'action */}
      {showModal && selectedRequest && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {actionType === 'approve' ? '✅ Approuver' : '❌ Rejeter'} la demande
              </h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            
            <div className="modal-body">
              <div className="request-summary">
                <h4>{getClientDisplayName(selectedRequest)}</h4>
                <p>
                  <strong>Type:</strong> {
                    selectedRequest.type_demande === 'modification_profil' ? 
                    'Modification de profil' : 
                    'Changement de mot de passe'
                  }
                </p>
                <p><strong>Demandé le:</strong> {formatDate(selectedRequest.date_demande)}</p>
              </div>
              
              {actionType === 'reject' && (
                <div className="rejection-reason">
                  <label htmlFor="rejectionReason">
                    Motif du rejet <span className="optional">(optionnel)</span>:
                  </label>
                  <textarea
                    id="rejectionReason"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Expliquez pourquoi cette demande est rejetée..."
                    rows="3"
                  />
                </div>
              )}
              
              <div className="confirmation-text">
                {actionType === 'approve' ? (
                  <p>
                    ✅ <strong>Confirmation d'approbation</strong><br/>
                    Cette action appliquera immédiatement les modifications demandées et 
                    notifiera le client de l'approbation.
                  </p>
                ) : (
                  <p>
                    ❌ <strong>Confirmation de rejet</strong><br/>
                    Cette action supprimera la demande et notifiera le client du rejet
                    {rejectionReason && ' avec le motif spécifié'}.
                  </p>
                )}
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="cancel-btn" 
                onClick={closeModal}
                disabled={processing}
              >
                Annuler
              </button>
              
              <button
                className={`confirm-btn ${actionType === 'approve' ? 'approve' : 'reject'}`}
                onClick={processRequest}
                disabled={processing}
              >
                {processing ? (
                  <>
                    <span className="btn-spinner">⏳</span>
                    <span>Traitement...</span>
                  </>
                ) : (
                  <>
                    <span className="btn-icon">
                      {actionType === 'approve' ? '✅' : '❌'}
                    </span>
                    <span>
                      {actionType === 'approve' ? 'Confirmer Approbation' : 'Confirmer Rejet'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRequestsModule;