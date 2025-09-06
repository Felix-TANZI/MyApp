import React, { useState, useEffect } from 'react';

const ClientInvoicesModule = ({ onBack }) => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  useEffect(() => {
    fetchMyInvoices();
  }, [currentPage, searchTerm, selectedStatus]);

  const fetchMyInvoices = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage,
        limit: 10,
        search: searchTerm,
        statut: selectedStatus
      });

      const response = await fetch(`http://localhost:5000/api/client/factures?${params}`, {
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
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (invoice) => {
    try {
      const response = await fetch(`http://localhost:5000/api/client/factures/${invoice.id}/pdf`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors du téléchargement');
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const getStatusBadge = (status) => {
    const badges = {
      'envoyee': { class: 'warning', text: 'Envoyée', icon: '📤' },
      'payee': { class: 'success', text: 'Payée', icon: '✅' },
      'en_retard': { class: 'danger', text: 'En retard', icon: '⚠️' }
    };
    return badges[status] || badges.envoyee;
  };

  const containerStyle = {
    padding: '24px',
    backgroundColor: '#f8fafc',
    minHeight: '100vh'
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  };

  const titleStyle = {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1e293b',
    margin: 0
  };

  const backButtonStyle = {
    padding: '8px 16px',
    backgroundColor: '#e2e8f0',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  };

  const filtersStyle = {
    display: 'flex',
    gap: '16px',
    marginBottom: '24px',
    padding: '16px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  };

  const inputStyle = {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px'
  };

  const tableStyle = {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  };

  const thStyle = {
    padding: '12px',
    backgroundColor: '#f8fafc',
    borderBottom: '1px solid #e5e7eb',
    fontWeight: '600',
    textAlign: 'left'
  };

  const tdStyle = {
    padding: '12px',
    borderBottom: '1px solid #f3f4f6'
  };

  const badgeStyle = (status) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600',
    backgroundColor: status === 'success' ? '#dcfce7' : 
                    status === 'warning' ? '#fef3c7' : '#fecaca',
    color: status === 'success' ? '#166534' : 
           status === 'warning' ? '#92400e' : '#dc2626'
  });

  const buttonStyle = {
    padding: '6px 12px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500'
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '48px' }}>
          <p>Chargement de vos factures...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>Mes Factures</h1>
        <button style={backButtonStyle} onClick={onBack}>
          ← Retour
        </button>
      </div>

      {error && (
        <div style={{
          padding: '12px',
          backgroundColor: '#fecaca',
          color: '#dc2626',
          borderRadius: '6px',
          marginBottom: '16px'
        }}>
          {error}
        </div>
      )}

      <div style={filtersStyle}>
        <input
          type="text"
          placeholder="Rechercher une facture..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={inputStyle}
        />
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          style={inputStyle}
        >
          <option value="">Tous les statuts</option>
          <option value="envoyee">Envoyées</option>
          <option value="payee">Payées</option>
          <option value="en_retard">En retard</option>
        </select>
      </div>

      {invoices.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '48px',
          backgroundColor: 'white',
          borderRadius: '8px'
        }}>
          <h3>Aucune facture trouvée</h3>
          <p>Vous n'avez pas encore de factures.</p>
        </div>
      ) : (
        <div style={tableStyle}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>N° Facture</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Montant</th>
                <th style={thStyle}>Statut</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td style={tdStyle}>{invoice.numero_facture}</td>
                  <td style={tdStyle}>{formatDate(invoice.date_facture)}</td>
                  <td style={tdStyle}>{formatCurrency(invoice.montant_ttc)}</td>
                  <td style={tdStyle}>
                    <span style={badgeStyle(getStatusBadge(invoice.statut).class)}>
                      {getStatusBadge(invoice.statut).icon} {getStatusBadge(invoice.statut).text}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <button
                      style={buttonStyle}
                      onClick={() => handleDownloadPDF(invoice)}
                    >
                      📄 PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '24px',
          padding: '16px',
          backgroundColor: 'white',
          borderRadius: '8px'
        }}>
          <button
            disabled={!pagination.hasPrev}
            onClick={() => setCurrentPage(currentPage - 1)}
            style={buttonStyle}
          >
            ← Précédent
          </button>
          <span>
            Page {pagination.page} sur {pagination.totalPages}
          </span>
          <button
            disabled={!pagination.hasNext}
            onClick={() => setCurrentPage(currentPage + 1)}
            style={buttonStyle}
          >
            Suivant →
          </button>
        </div>
      )}
    </div>
  );
};

export default ClientInvoicesModule;