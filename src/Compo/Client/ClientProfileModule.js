import React, { useState, useEffect } from 'react';

const ClientProfileModule = ({ onBack }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const [editData, setEditData] = useState({
    nom: '',
    prenom: '',
    telephone: '',
    adresse: '',
    ville: '',
    pays: ''
  });

  const [passwordData, setPasswordData] = useState({
    mot_de_passe_actuel: '',
    nouveau_mot_de_passe: '',
    confirmer_mot_de_passe: ''
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/client/profile', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors du chargement du profil');
      }

      const data = await response.json();
      setProfile(data.data);
      setEditData({
        nom: data.data.nom || '',
        prenom: data.data.prenom || '',
        telephone: data.data.telephone || '',
        adresse: data.data.adresse || '',
        ville: data.data.ville || '',
        pays: data.data.pays || ''
      });
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/client/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }

      setSuccess('Demande de modification envoyée. Elle sera examinée par un administrateur.');
      setShowEditForm(false);
      setTimeout(() => setSuccess(null), 5000);
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
      const response = await fetch('http://localhost:5000/api/client/password', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mot_de_passe_actuel: passwordData.mot_de_passe_actuel,
          nouveau_mot_de_passe: passwordData.nouveau_mot_de_passe
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }

      setSuccess('Demande de changement de mot de passe envoyée.');
      setShowPasswordForm(false);
      setPasswordData({
        mot_de_passe_actuel: '',
        nouveau_mot_de_passe: '',
        confirmer_mot_de_passe: ''
      });
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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

  const cardStyle = {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '24px',
    marginBottom: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  };

  const buttonStyle = {
    padding: '8px 16px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    marginRight: '12px'
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    marginBottom: '16px'
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '4px',
    fontWeight: '500',
    color: '#374151'
  };

  if (loading && !profile) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '48px' }}>
          <p>Chargement de votre profil...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>Mon Profil</h1>
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

      {success && (
        <div style={{
          padding: '12px',
          backgroundColor: '#dcfce7',
          color: '#166534',
          borderRadius: '6px',
          marginBottom: '16px'
        }}>
          {success}
        </div>
      )}

      {/* Informations actuelles */}
      <div style={cardStyle}>
        <h2 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>
          Informations personnelles
        </h2>
        
        {profile && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <strong>Code client:</strong>
              <p>{profile.code_client}</p>
            </div>
            <div>
              <strong>Email:</strong>
              <p>{profile.email}</p>
            </div>
            <div>
              <strong>Nom:</strong>
              <p>{profile.nom}</p>
            </div>
            <div>
              <strong>Prénom:</strong>
              <p>{profile.prenom || 'Non renseigné'}</p>
            </div>
            <div>
              <strong>Entreprise:</strong>
              <p>{profile.entreprise || 'Non renseigné'}</p>
            </div>
            <div>
              <strong>Téléphone:</strong>
              <p>{profile.telephone || 'Non renseigné'}</p>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <strong>Adresse:</strong>
              <p>{profile.adresse || 'Non renseigné'}</p>
            </div>
            <div>
              <strong>Ville:</strong>
              <p>{profile.ville}</p>
            </div>
            <div>
              <strong>Pays:</strong>
              <p>{profile.pays}</p>
            </div>
          </div>
        )}

        <div style={{ marginTop: '24px' }}>
          <button
            style={buttonStyle}
            onClick={() => setShowEditForm(true)}
            disabled={profile?.has_modification_pending}
          >
            {profile?.has_modification_pending ? 'Modification en attente' : 'Modifier mes informations'}
          </button>
          <button
            style={buttonStyle}
            onClick={() => setShowPasswordForm(true)}
            disabled={profile?.has_password_change_pending}
          >
            {profile?.has_password_change_pending ? 'Changement en attente' : 'Changer mot de passe'}
          </button>
        </div>
      </div>

      {/* Formulaire de modification */}
      {showEditForm && (
        <div style={cardStyle}>
          <h3 style={{ marginBottom: '16px' }}>Modifier mes informations</h3>
          <p style={{ color: '#6b7280', marginBottom: '16px' }}>
            Votre demande sera examinée par un administrateur avant d'être appliquée.
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Nom *</label>
              <input
                type="text"
                value={editData.nom}
                onChange={(e) => setEditData({...editData, nom: e.target.value})}
                style={inputStyle}
                required
              />
            </div>
            <div>
              <label style={labelStyle}>Prénom</label>
              <input
                type="text"
                value={editData.prenom}
                onChange={(e) => setEditData({...editData, prenom: e.target.value})}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Téléphone</label>
              <input
                type="tel"
                value={editData.telephone}
                onChange={(e) => setEditData({...editData, telephone: e.target.value})}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Ville</label>
              <input
                type="text"
                value={editData.ville}
                onChange={(e) => setEditData({...editData, ville: e.target.value})}
                style={inputStyle}
              />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>Adresse</label>
              <input
                type="text"
                value={editData.adresse}
                onChange={(e) => setEditData({...editData, adresse: e.target.value})}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Pays</label>
              <input
                type="text"
                value={editData.pays}
                onChange={(e) => setEditData({...editData, pays: e.target.value})}
                style={inputStyle}
              />
            </div>
          </div>
          
          <div style={{ marginTop: '16px' }}>
            <button style={buttonStyle} onClick={handleUpdateProfile} disabled={loading}>
              {loading ? 'Envoi...' : 'Envoyer la demande'}
            </button>
            <button
              style={{...buttonStyle, backgroundColor: '#6b7280'}}
              onClick={() => setShowEditForm(false)}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Formulaire de changement de mot de passe */}
      {showPasswordForm && (
        <div style={cardStyle}>
          <h3 style={{ marginBottom: '16px' }}>Changer mon mot de passe</h3>
          <p style={{ color: '#6b7280', marginBottom: '16px' }}>
            Votre demande sera examinée par un administrateur avant d'être appliquée.
          </p>
          
          <div>
            <label style={labelStyle}>Mot de passe actuel *</label>
            <input
              type="password"
              value={passwordData.mot_de_passe_actuel}
              onChange={(e) => setPasswordData({...passwordData, mot_de_passe_actuel: e.target.value})}
              style={inputStyle}
              required
            />
          </div>
          
          <div>
            <label style={labelStyle}>Nouveau mot de passe *</label>
            <input
              type="password"
              value={passwordData.nouveau_mot_de_passe}
              onChange={(e) => setPasswordData({...passwordData, nouveau_mot_de_passe: e.target.value})}
              style={inputStyle}
              minLength="6"
              required
            />
          </div>
          
          <div>
            <label style={labelStyle}>Confirmer le nouveau mot de passe *</label>
            <input
              type="password"
              value={passwordData.confirmer_mot_de_passe}
              onChange={(e) => setPasswordData({...passwordData, confirmer_mot_de_passe: e.target.value})}
              style={inputStyle}
              required
            />
          </div>
          
          <div style={{ marginTop: '16px' }}>
            <button style={buttonStyle} onClick={handleChangePassword} disabled={loading}>
              {loading ? 'Envoi...' : 'Envoyer la demande'}
            </button>
            <button
              style={{...buttonStyle, backgroundColor: '#6b7280'}}
              onClick={() => {
                setShowPasswordForm(false);
                setPasswordData({
                  mot_de_passe_actuel: '',
                  nouveau_mot_de_passe: '',
                  confirmer_mot_de_passe: ''
                });
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientProfileModule;