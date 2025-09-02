import React, { useState, useEffect } from 'react';
import './InvoicesModule.css';

const InvoicesModule = ({ user }) => {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [stats, setStats] = useState({});
  
  // États pour la recherche et filtrage
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({});
  
  // États pour les modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  
  // État du formulaire de facture
  const [formData, setFormData] = useState({
    client_id: '',
    date_facture: new Date().toISOString().split('T')[0],
    date_echeance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    type_facture: 'hebergement',
    note_interne: '',
    message_client: '',
    statut: 'brouillon',
    lignes: [
      {
        designation: '',
        description: '',
        quantite: 1,
        prix_unitaire: 0,
        montant_ligne: 0
      }
    ]
  });

  // État pour le changement de statut
  const [statusData, setStatusData] = useState({
    statut: '',
    mode_paiement: '',
    reference_paiement: ''
  });

  useEffect(() => {
    fetchInvoices();
    fetchStats();
    fetchClients();
  }, [currentPage, searchTerm, selectedStatus, selectedType, selectedClient, dateDebut, dateFin]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage,
        limit: 10,
        search: searchTerm,
        statut: selectedStatus,
        type: selectedType,
        clientId: selectedClient,
        dateDebut: dateDebut,
        dateFin: dateFin
      });

      const response = await fetch(`http://localhost:5000/api/invoices?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors du chargement des factures');
      }

      const data = await response.json();
      setInvoices(data.data.factures);
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
      const response = await fetch('http://localhost:5000/api/invoices/stats', {
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

  const fetchClients = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/clients?limit=1000', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setClients(data.data.clients);
      }
    } catch (err) {
      console.error('Erreur clients:', err);
    }
  };

  const calculateLigneAmount = (quantite, prixUnitaire) => {
    return parseFloat((parseFloat(quantite || 0) * parseFloat(prixUnitaire || 0)).toFixed(2));
  };

  const calculateTotals = (lignes) => {
    const montantHT = lignes.reduce((sum, ligne) => sum + parseFloat(ligne.montant_ligne || 0), 0);
    const montantTVA = (montantHT * 19.25) / 100;
    const montantTTC = montantHT + montantTVA;
    
    return {
      montantHT: parseFloat(montantHT.toFixed(2)),
      montantTVA: parseFloat(montantTVA.toFixed(2)),
      montantTTC: parseFloat(montantTTC.toFixed(2))
    };
  };

  const handleCreateInvoice = async () => {
    try {
      setLoading(true);
      
      // Calculer les montants des lignes
      const lignesWithAmounts = formData.lignes.map(ligne => ({
        ...ligne,
        montant_ligne: calculateLigneAmount(ligne.quantite, ligne.prix_unitaire)
      }));

      const invoiceData = {
        ...formData,
        lignes: lignesWithAmounts
      };

      const response = await fetch('http://localhost:5000/api/invoices', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(invoiceData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }

      await fetchInvoices();
      await fetchStats();
      setShowCreateModal(false);
      resetForm();
      setSuccess('Facture créée avec succès');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditInvoice = async () => {
    try {
      setLoading(true);
      
      const lignesWithAmounts = formData.lignes.map(ligne => ({
        ...ligne,
        montant_ligne: calculateLigneAmount(ligne.quantite, ligne.prix_unitaire)
      }));

      const invoiceData = {
        ...formData,
        lignes: lignesWithAmounts
      };

      const response = await fetch(`http://localhost:5000/api/invoices/${selectedInvoice.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(invoiceData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }

      await fetchInvoices();
      await fetchStats();
      setShowEditModal(false);
      setSelectedInvoice(null);
      resetForm();
      setSuccess('Facture modifiée avec succès');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInvoice = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/invoices/${selectedInvoice.id}`, {
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

      await fetchInvoices();
      await fetchStats();
      setShowDeleteModal(false);
      setSelectedInvoice(null);
      setSuccess('Facture supprimée avec succès');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/invoices/${selectedInvoice.id}/status`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(statusData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }

      await fetchInvoices();
      await fetchStats();
      setShowStatusModal(false);
      setSelectedInvoice(null);
      setStatusData({ statut: '', mode_paiement: '', reference_paiement: '' });
      setSuccess('Statut mis à jour avec succès');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicateInvoice = async (invoice) => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/invoices/${invoice.id}/duplicate`, {
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

      await fetchInvoices();
      await fetchStats();
      setSuccess('Facture dupliquée avec succès');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (invoice) => {
    try {
      const response = await fetch(`http://localhost:5000/api/invoices/${invoice.id}/pdf`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors du téléchargement du PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `facture-${invoice.numero_facture}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      client_id: '',
      date_facture: new Date().toISOString().split('T')[0],
      date_echeance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      type_facture: 'hebergement',
      note_interne: '',
      message_client: '',
      statut: 'brouillon',
      lignes: [
        {
          designation: '',
          description: '',
          quantite: 1,
          prix_unitaire: 0,
          montant_ligne: 0
        }
      ]
    });
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = async (invoice) => {
    try {
      // Récupérer la facture complète avec ses lignes
      const response = await fetch(`http://localhost:5000/api/invoices/${invoice.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors du chargement de la facture');
      }

      const data = await response.json();
      const fullInvoice = data.data;

      setSelectedInvoice(fullInvoice);
      setFormData({
        client_id: fullInvoice.client_id,
        date_facture: fullInvoice.date_facture,
        date_echeance: fullInvoice.date_echeance,
        type_facture: fullInvoice.type_facture,
        note_interne: fullInvoice.note_interne || '',
        message_client: fullInvoice.message_client || '',
        statut: fullInvoice.statut,
        lignes: fullInvoice.lignes.length > 0 ? fullInvoice.lignes : [
          {
            designation: '',
            description: '',
            quantite: 1,
            prix_unitaire: 0,
            montant_ligne: 0
          }
        ]
      });
      setShowEditModal(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const openDeleteModal = (invoice) => {
    setSelectedInvoice(invoice);
    setShowDeleteModal(true);
  };

  const openStatusModal = (invoice) => {
    setSelectedInvoice(invoice);
    setStatusData({
      statut: invoice.statut,
      mode_paiement: '',
      reference_paiement: ''
    });
    setShowStatusModal(true);
  };

  const openPreviewModal = async (invoice) => {
    try {
      // Récupérer la facture complète
      const response = await fetch(`http://localhost:5000/api/invoices/${invoice.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors du chargement de la facture');
      }

      const data = await response.json();
      setSelectedInvoice(data.data);
      setShowPreviewModal(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLigneChange = (index, field, value) => {
    setFormData(prev => {
      const newLignes = [...prev.lignes];
      newLignes[index] = {
        ...newLignes[index],
        [field]: value
      };
      
      // Recalculer le montant de la ligne si quantité ou prix change
      if (field === 'quantite' || field === 'prix_unitaire') {
        newLignes[index].montant_ligne = calculateLigneAmount(
          newLignes[index].quantite,
          newLignes[index].prix_unitaire
        );
      }
      
      return {
        ...prev,
        lignes: newLignes
      };
    });
  };

  const addLigne = () => {
    setFormData(prev => ({
      ...prev,
      lignes: [
        ...prev.lignes,
        {
          designation: '',
          description: '',
          quantite: 1,
          prix_unitaire: 0,
          montant_ligne: 0
        }
      ]
    }));
  };

  const removeLigne = (index) => {
    if (formData.lignes.length > 1) {
      setFormData(prev => ({
        ...prev,
        lignes: prev.lignes.filter((_, i) => i !== index)
      }));
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
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
      'brouillon': { class: 'brouillon', text: 'Brouillon', icon: '📝' },
      'envoyee': { class: 'envoyee', text: 'Envoyée', icon: '📤' },
      'payee': { class: 'payee', text: 'Payée', icon: '✅' },
      'en_retard': { class: 'en_retard', text: 'En retard', icon: '⚠️' },
      'annulee': { class: 'annulee', text: 'Annulée', icon: '❌' }
    };
    return badges[status] || badges.brouillon;
  };

  const getTypeBadge = (type) => {
    const badges = {
      'hebergement': { class: 'hebergement', text: 'Hébergement', icon: '🏨' },
      'restauration': { class: 'restauration', text: 'Restauration', icon: '🍽️' },
      'evenement': { class: 'evenement', text: 'Événement', icon: '🎉' },
      'autre': { class: 'autre', text: 'Autre', icon: '📋' }
    };
    return badges[type] || badges.autre;
  };

  const isInvoiceEditable = (invoice) => {
    return invoice.statut !== 'payee' || user.role === 'admin';
  };

  const isInvoiceDeletable = (invoice) => {
    return invoice.statut !== 'payee' || user.role === 'admin';
  };

  const totals = calculateTotals(formData.lignes);

  return (
    <div className="invoices-module">
      {/* En-tête avec statistiques */}
      <div className="module-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Gestion des Factures</h1>
            <p>Créer, modifier et suivre les factures de l'hôtel</p>
          </div>
          <div className="header-actions">
            <button className="btn-secondary" onClick={fetchInvoices}>
              <span>🔄</span>
              Actualiser
            </button>
            <button className="btn-primary" onClick={openCreateModal}>
              <span>➕</span>
              Nouvelle Facture
            </button>
          </div>
        </div>
        
        <div className="stats-cards">
          <div className="stat-card purple">
            <div className="stat-icon">📄</div>
            <div className="stat-content">
              <h3>{stats.total_factures || 0}</h3>
              <p>Total Factures</p>
            </div>
          </div>
          <div className="stat-card green">
            <div className="stat-icon">💰</div>
            <div className="stat-content">
              <h3 className="stat-amount">{formatCurrency(stats.ca_realise || 0)}</h3>
              <p>CA Réalisé</p>
            </div>
          </div>
          <div className="stat-card blue">
            <div className="stat-icon">📤</div>
            <div className="stat-content">
              <h3 className="stat-amount">{formatCurrency(stats.ca_en_attente || 0)}</h3>
              <p>En Attente</p>
            </div>
          </div>
          <div className="stat-card orange">
            <div className="stat-icon">⚠️</div>
            <div className="stat-content">
              <h3>{stats.en_retard || 0}</h3>
              <p>En Retard</p>
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
            placeholder="Rechercher une facture..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="filters">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="">Tous les statuts</option>
            <option value="brouillon">Brouillons</option>
            <option value="envoyee">Envoyées</option>
            <option value="payee">Payées</option>
            <option value="en_retard">En retard</option>
            <option value="annulee">Annulées</option>
          </select>
          
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <option value="">Tous les types</option>
            <option value="hebergement">Hébergement</option>
            <option value="restauration">Restauration</option>
            <option value="evenement">Événement</option>
            <option value="autre">Autre</option>
          </select>

          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
          >
            <option value="">Tous les clients</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>
                {client.nom} {client.prenom} {client.entreprise && `(${client.entreprise})`}
              </option>
            ))}
          </select>

          <div className="date-range">
            <input
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              placeholder="Date début"
            />
            <span>→</span>
            <input
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              placeholder="Date fin"
            />
          </div>
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

      {/* Table des factures */}
      <div className="invoices-table-container">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Chargement des factures...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📄</div>
            <h3>Aucune facture trouvée</h3>
            <p>Commencez par créer votre première facture</p>
            <button className="btn-primary" onClick={openCreateModal}>
              <span>➕</span>
              Créer une facture
            </button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="invoices-table">
              <thead>
                <tr>
                  <th>N° Facture</th>
                  <th>Client</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Échéance</th>
                  <th>Montant TTC</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <span className="invoice-number">{invoice.numero_facture}</span>
                    </td>
                    <td>
                      <div className="client-info">
                        <strong>{invoice.client_nom} {invoice.client_prenom}</strong>
                        {invoice.entreprise && (
                          <div className="company">{invoice.entreprise}</div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`type-badge ${getTypeBadge(invoice.type_facture).class}`}>
                        {getTypeBadge(invoice.type_facture).icon} {getTypeBadge(invoice.type_facture).text}
                      </span>
                    </td>
                    <td>{formatDate(invoice.date_facture)}</td>
                    <td>
                      <span className={`due-date ${new Date(invoice.date_echeance) < new Date() && invoice.statut !== 'payee' ? 'overdue' : ''}`}>
                        {formatDate(invoice.date_echeance)}
                      </span>
                    </td>
                    <td>
                      <div className="amount-info">
                        <div className="amount">{formatCurrency(invoice.montant_ttc)}</div>
                        <div className="currency">XAF</div>
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${getStatusBadge(invoice.statut).class}`}>
                        {getStatusBadge(invoice.statut).icon} {getStatusBadge(invoice.statut).text}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="btn-icon-action view"
                          onClick={() => openPreviewModal(invoice)}
                          title="Voir les détails"
                        >
                          👁️
                        </button>
                        {isInvoiceEditable(invoice) && (
                          <button 
                            className="btn-icon-action edit"
                            onClick={() => openEditModal(invoice)}
                            title="Modifier"
                          >
                            ✏️
                          </button>
                        )}
                        <button 
                          className="btn-icon-action pdf"
                          onClick={() => handleDownloadPDF(invoice)}
                          title="Télécharger PDF"
                        >
                          📄
                        </button>
                        <button 
                          className="btn-icon-action duplicate"
                          onClick={() => handleDuplicateInvoice(invoice)}
                          title="Dupliquer"
                        >
                          📋
                        </button>
                        <button 
                          className="btn-icon-action edit"
                          onClick={() => openStatusModal(invoice)}
                          title="Changer statut"
                        >
                          🔄
                        </button>
                        {isInvoiceDeletable(invoice) && (
                          <button 
                            className="btn-icon-action delete"
                            onClick={() => openDeleteModal(invoice)}
                            title="Supprimer"
                          >
                            🗑️
                          </button>
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
            ({pagination.total} factures)
          </span>
          <button 
            disabled={!pagination.hasNext}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Suivant →
          </button>
        </div>
      )}

      {/* Modal de création/édition */}
      {(showCreateModal || showEditModal) && (
        <InvoiceFormModal
          title={showCreateModal ? "Nouvelle Facture" : "Modifier Facture"}
          formData={formData}
          clients={clients}
          onChange={handleFormChange}
          onLigneChange={handleLigneChange}
          onAddLigne={addLigne}
          onRemoveLigne={removeLigne}
          onSubmit={showCreateModal ? handleCreateInvoice : handleEditInvoice}
          onClose={() => {
            setShowCreateModal(false);
            setShowEditModal(false);
            setSelectedInvoice(null);
            resetForm();
          }}
          loading={loading}
          isEdit={showEditModal}
          totals={totals}
        />
      )}

      {/* Modal de suppression */}
      {showDeleteModal && (
        <DeleteInvoiceModal
          invoice={selectedInvoice}
          onConfirm={handleDeleteInvoice}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedInvoice(null);
          }}
          loading={loading}
        />
      )}

      {/* Modal de changement de statut */}
      {showStatusModal && (
        <StatusChangeModal
          invoice={selectedInvoice}
          statusData={statusData}
          onStatusChange={setStatusData}
          onConfirm={handleStatusChange}
          onClose={() => {
            setShowStatusModal(false);
            setSelectedInvoice(null);
            setStatusData({ statut: '', mode_paiement: '', reference_paiement: '' });
          }}
          loading={loading}
        />
      )}

      {/* Modal de prévisualisation */}
      {showPreviewModal && (
        <InvoicePreviewModal
          invoice={selectedInvoice}
          onClose={() => {
            setShowPreviewModal(false);
            setSelectedInvoice(null);
          }}
          onDownloadPDF={() => handleDownloadPDF(selectedInvoice)}
        />
      )}
    </div>
  );
};

// Composant Modal de formulaire de facture
const InvoiceFormModal = ({ 
  title, 
  formData, 
  clients,
  onChange, 
  onLigneChange,
  onAddLigne,
  onRemoveLigne,
  onSubmit, 
  onClose, 
  loading, 
  isEdit,
  totals
}) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  // Fonction formatCurrency locale
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="modal-overlay">
      <div className="modal invoice-form-modal">
        <div className="modal-header">
          <h3>
            <span>📄</span>
            {title}
          </h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <form onSubmit={handleSubmit} className="invoice-form">
            <div className="form-sections">
              {/* Section Informations générales */}
              <div className="form-section">
                <h4 className="section-title">
                  <span className="section-icon">ℹ️</span>
                  Informations générales
                </h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="client_id">Client *</label>
                    <select
                      id="client_id"
                      name="client_id"
                      value={formData.client_id}
                      onChange={onChange}
                      required
                    >
                      <option value="">Sélectionner un client</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>
                          {client.nom} {client.prenom} {client.entreprise && `(${client.entreprise})`}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="type_facture">Type de facture *</label>
                    <select
                      id="type_facture"
                      name="type_facture"
                      value={formData.type_facture}
                      onChange={onChange}
                      required
                    >
                      <option value="hebergement">Hébergement</option>
                      <option value="restauration">Restauration</option>
                      <option value="evenement">Événement</option>
                      <option value="autre">Autre</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="date_facture">Date de facture *</label>
                    <input
                      type="date"
                      id="date_facture"
                      name="date_facture"
                      value={formData.date_facture}
                      onChange={onChange}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="date_echeance">Date d'échéance *</label>
                    <input
                      type="date"
                      id="date_echeance"
                      name="date_echeance"
                      value={formData.date_echeance}
                      onChange={onChange}
                      required
                    />
                  </div>
                  
                  <div className="form-group full-width">
                    <label htmlFor="note_interne">Note interne</label>
                    <textarea
                      id="note_interne"
                      name="note_interne"
                      value={formData.note_interne}
                      onChange={onChange}
                      rows="3"
                      placeholder="Notes visibles uniquement par le personnel..."
                    ></textarea>
                  </div>
                  
                  <div className="form-group full-width">
                    <label htmlFor="message_client">Message client</label>
                    <textarea
                      id="message_client"
                      name="message_client"
                      value={formData.message_client}
                      onChange={onChange}
                      rows="3"
                      placeholder="Message visible sur la facture pour le client..."
                    ></textarea>
                  </div>
                </div>
              </div>

              {/* Section Lignes de facture */}
              <div className="form-section">
                <div className="lines-editor">
                  <div className="lines-header">
                    <h4>Lignes de facture</h4>
                    <button 
                      type="button"
                      className="btn-add-line"
                      onClick={onAddLigne}
                    >
                      <span>➕</span>
                      Ajouter une ligne
                    </button>
                  </div>
                  
                  <table className="lines-table">
                    <thead>
                      <tr>
                        <th>Désignation *</th>
                        <th>Description</th>
                        <th>Qté</th>
                        <th>Prix unitaire</th>
                        <th>Montant</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.lignes.map((ligne, index) => (
                        <tr key={index}>
                          <td>
                            <input
                              type="text"
                              className="line-input"
                              placeholder="Ex: Chambre Suite Junior"
                              value={ligne.designation}
                              onChange={(e) => onLigneChange(index, 'designation', e.target.value)}
                              required
                            />
                          </td>
                          <td>
                            <textarea
                              className="line-input line-textarea"
                              placeholder="Description détaillée..."
                              value={ligne.description}
                              onChange={(e) => onLigneChange(index, 'description', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="line-input number"
                              min="0"
                              step="0.01"
                              value={ligne.quantite}
                              onChange={(e) => onLigneChange(index, 'quantite', e.target.value)}
                              required
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="line-input number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={ligne.prix_unitaire}
                              onChange={(e) => onLigneChange(index, 'prix_unitaire', e.target.value)}
                              required
                            />
                          </td>
                          <td>
                            <div className="amount-calculated">
                              {new Intl.NumberFormat('fr-FR').format(ligne.montant_ligne || 0)} XAF
                            </div>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn-remove-line"
                              onClick={() => onRemoveLigne(index)}
                              disabled={formData.lignes.length === 1}
                              title="Supprimer cette ligne"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {/* Récapitulatif des totaux */}
                  <div className="totals-summary">
                    <div className="totals-grid">
                      <div className="totals-info">
                        <p><strong>TVA Cameroun :</strong> 19,25%</p>
                        <p><strong>Devise :</strong> Franc CFA (XAF)</p>
                        <p><small>Les montants sont calculés automatiquement</small></p>
                      </div>
                      <div className="totals-calculations">
                        <div className="total-line">
                          <span className="total-label">Montant HT :</span>
                          <span className="total-amount">{formatCurrency(totals.montantHT)}</span>
                        </div>
                        <div className="total-line">
                          <span className="total-label">TVA (19,25%) :</span>
                          <span className="total-amount">{formatCurrency(totals.montantTVA)}</span>
                        </div>
                        <div className="total-line">
                          <span className="total-label">Total TTC :</span>
                          <span className="total-amount">{formatCurrency(totals.montantTTC)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
        
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
            type="button"
            className="btn-secondary"
            onClick={() => {
              const updatedFormData = { ...formData, statut: 'brouillon' };
              onSubmit(updatedFormData);
            }}
            disabled={loading}
          >
            💾 Sauvegarder en brouillon
          </button>
          <button 
            type="submit"
            className="btn-primary"
            onClick={handleSubmit}
            disabled={loading || !formData.client_id || formData.lignes.some(l => !l.designation)}
          >
            {loading ? 'Enregistrement...' : (isEdit ? '✏️ Modifier' : '📄 Créer')}
          </button>
        </div>
      </div>
    </div>
  );
};

// Composant Modal de suppression
const DeleteInvoiceModal = ({ invoice, onConfirm, onClose, loading }) => (
  <div className="modal-overlay">
    <div className="modal">
      <div className="modal-header">
        <h3>
          <span>🗑️</span>
          Supprimer la facture
        </h3>
      </div>
      <div className="modal-body">
        <p>
          Êtes-vous sûr de vouloir supprimer la facture{' '}
          <strong>{invoice?.numero_facture}</strong> ?
        </p>
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          Cette action est irréversible. Toutes les lignes de facture seront également supprimées.
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
          style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? 'Suppression...' : '🗑️ Supprimer'}
        </button>
      </div>
    </div>
  </div>
);

// Composant Modal de changement de statut
const StatusChangeModal = ({ invoice, statusData, onStatusChange, onConfirm, onClose, loading }) => {
  const statusOptions = [
    { value: 'brouillon', label: 'Brouillon', icon: '📝', color: '#6b7280' },
    { value: 'envoyee', label: 'Envoyée', icon: '📤', color: '#f59e0b' },
    { value: 'payee', label: 'Payée', icon: '✅', color: '#10b981' },
    { value: 'en_retard', label: 'En retard', icon: '⚠️', color: '#ef4444' },
    { value: 'annulee', label: 'Annulée', icon: '❌', color: '#6b7280' }
  ];

  const handleStatusSelect = (statut) => {
    onStatusChange(prev => ({ ...prev, statut }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    onStatusChange(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="modal-overlay">
      <div className="modal status-modal">
        <div className="modal-header">
          <h3>
            <span>🔄</span>
            Changer le statut - {invoice?.numero_facture}
          </h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="status-options">
            {statusOptions.map(option => (
              <div
                key={option.value}
                className={`status-option ${statusData.statut === option.value ? 'selected' : ''}`}
                onClick={() => handleStatusSelect(option.value)}
              >
                <div className="status-option-icon">{option.icon}</div>
                <p className="status-option-name">{option.label}</p>
              </div>
            ))}
          </div>

          {statusData.statut === 'payee' && (
            <div className="payment-fields">
              <h5>Informations de paiement</h5>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="mode_paiement">Mode de paiement</label>
                  <select
                    id="mode_paiement"
                    name="mode_paiement"
                    value={statusData.mode_paiement}
                    onChange={handleInputChange}
                  >
                    <option value="">Sélectionner...</option>
                    <option value="especes">Espèces</option>
                    <option value="carte_bancaire">Carte bancaire</option>
                    <option value="virement">Virement</option>
                    <option value="cheque">Chèque</option>
                    <option value="mobile_money">Mobile Money</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="reference_paiement">Référence de paiement</label>
                  <input
                    type="text"
                    id="reference_paiement"
                    name="reference_paiement"
                    value={statusData.reference_paiement}
                    onChange={handleInputChange}
                    placeholder="Numéro de transaction, etc."
                  />
                </div>
              </div>
            </div>
          )}
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
            disabled={loading || !statusData.statut}
          >
            {loading ? 'Mise à jour...' : '🔄 Mettre à jour'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Composant Modal de prévisualisation
const InvoicePreviewModal = ({ invoice, onClose, onDownloadPDF }) => {
  if (!invoice) return null;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: '900px', maxWidth: '95vw' }}>
        <div className="modal-header">
          <h3>
            <span>👁️</span>
            Aperçu - {invoice.numero_facture}
          </h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="invoice-preview">
            {/* En-tête de facture */}
            <div className="preview-header">
              <div className="company-info">
                <h2>HILTON YAOUNDÉ</h2>
                <p>Boulevard du 20 Mai</p>
                <p>Yaoundé, Cameroun</p>
                <p>Tél: +237 222 XXX XXX</p>
              </div>
              <div className="invoice-info">
                <h3 className="invoice-title">FACTURE</h3>
                <div className="invoice-details">
                  <p><strong>N° :</strong> {invoice.numero_facture}</p>
                  <p><strong>Date :</strong> {formatDate(invoice.date_facture)}</p>
                  <p><strong>Échéance :</strong> {formatDate(invoice.date_echeance)}</p>
                </div>
              </div>
            </div>

            {/* Informations client */}
            <div className="client-section">
              <h4>Facturé à :</h4>
              <p><strong>{invoice.client_nom} {invoice.client_prenom}</strong></p>
              {invoice.entreprise && <p>{invoice.entreprise}</p>}
              <p>{invoice.client_email}</p>
              {invoice.client_adresse && <p>{invoice.client_adresse}</p>}
              <p>{invoice.client_ville}, {invoice.client_pays}</p>
            </div>

            {/* Message client */}
            {invoice.message_client && (
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                <p style={{ margin: 0, fontStyle: 'italic', color: '#374151' }}>{invoice.message_client}</p>
              </div>
            )}

            {/* Lignes de facture */}
            <table className="preview-lines-table">
              <thead>
                <tr>
                  <th>Désignation</th>
                  <th>Description</th>
                  <th>Qté</th>
                  <th>Prix unitaire</th>
                  <th>Montant</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lignes.map((ligne, index) => (
                  <tr key={index}>
                    <td>{ligne.designation}</td>
                    <td>{ligne.description}</td>
                    <td>{ligne.quantite}</td>
                    <td>{formatCurrency(ligne.prix_unitaire)}</td>
                    <td>{formatCurrency(ligne.montant_ligne)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totaux */}
            <div className="preview-totals">
              <table className="totals-table">
                <tbody>
                  <tr>
                    <td>Montant HT :</td>
                    <td>{formatCurrency(invoice.montant_ht)}</td>
                  </tr>
                  <tr>
                    <td>TVA (19,25%) :</td>
                    <td>{formatCurrency(invoice.montant_tva)}</td>
                  </tr>
                  <tr>
                    <td><strong>Total TTC :</strong></td>
                    <td><strong>{formatCurrency(invoice.montant_ttc)}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            className="btn-secondary"
            onClick={onClose}
          >
            Fermer
          </button>
          <button 
            className="btn-primary"
            onClick={onDownloadPDF}
          >
            <span>📄</span>
            Télécharger PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvoicesModule;