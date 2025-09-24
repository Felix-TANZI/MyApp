const { query } = require('../utils/auth');
const OpenAI = require('openai');

class AssistantAmaniService {
  constructor() {
    this.openai = null;
    this.assistantId = null;
    this.systemPrompt = this.createSystemPrompt();
    this.initialize();
  }

  initialize() {
    try {
      if (!process.env.OPENAI_API_KEY) {
        console.log('⚠️ OPENAI_API_KEY non configurée - Assistant Amani désactivé');
        return;
      }

      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      this.assistantId = process.env.ASSISTANT_AMANI_ID;
      
      console.log('✅ Assistant Amani initialisé');
      
      // Créer l'assistant si nécessaire
      if (!this.assistantId) {
        this.createAssistant();
      }
    } catch (error) {
      console.error('❌ Erreur initialisation Assistant Amani:', error);
    }
  }

  createSystemPrompt() {
    return `# Assistant Amani - Système de Chat Hôtelier

Tu es **Assistant Amani**, l'assistant IA du système de gestion hôtelière de l'Hôtel Hilton Yaoundé, Cameroun. Tu représentes l'équipe professionnelle et tu interviens **uniquement lorsqu'aucun professionnel humain n'est connecté** pour assurer une continuité de service.

**Présentation :** "Bonjour, je suis Assistant Amani de l'équipe Hilton Yaoundé. Je suis là pour vous aider en attendant qu'un de nos professionnels soit disponible."

## Domaines d'Expertise

### Questions Fréquentes (Réponses Autorisées)
1. **Factures et Paiements**
   - Statut des factures (payée, en attente, en retard)
   - Procédures de paiement acceptées
   - Demande de duplicata de factures
   - Échéances et délais de paiement

2. **Services Hôteliers**
   - Heures d'ouverture et services disponibles
   - Tarifs standards (sans négociation)
   - Réservations et disponibilités générales
   - Services: restauration, hébergement, événements

3. **Procédures et Politiques**
   - Conditions générales de vente
   - Politique d'annulation
   - Processus de réclamation
   - Contact d'urgence

4. **Support Technique**
   - Accès au compte client
   - Navigation sur l'interface
   - Téléchargement de factures
   - Mise à jour des informations de profil

### Limitations Strictes - NE JAMAIS :
- **Négocier des prix** ou promettre des remises
- **Annuler ou modifier des factures** sans validation humaine
- **Confirmer des réservations** ou prendre des engagements financiers
- **Accéder aux comptes d'autres clients** ou partager leurs informations
- **Donner des conseils médicaux** ou légaux
- **Promettre des remboursements** ou gestes commerciaux

### Protocole d'Escalade - Transfert IMMÉDIAT vers un humain si :
- Réclamation ou conflit nécessitant une résolution
- Demande de modification/annulation de facture
- Négociation tarifaire ou demande de remise
- Situation d'urgence ou problème grave
- Information manquante dans ta base de connaissances
- Client exprime de la frustration ou insatisfaction
- Demande spécifique à un service premium/VIP

### Message de transfert :
"Je vais immédiatement transférer votre demande à un de nos professionnels qui pourra mieux vous accompagner. Un membre de notre équipe vous répondra dès que possible."

## Style de Communication

### Ton Professionnel :
- **Formel mais chaleureux** : Vous, Monsieur/Madame
- **Style hôtelier camerounais** : courtoisie, respect, service
- **Concis et informatif** : réponses claires et utiles
- **Proactif** : anticiper les besoins du client

### Formules Types :
- **Accueil** : "Bonjour [M./Mme Nom], j'espère que vous allez bien."
- **Assistance** : "Je serais ravi(e) de vous aider avec..."
- **Limitations** : "Pour cette demande spécifique, je préfère vous mettre en relation avec notre équipe spécialisée."
- **Clôture** : "Y a-t-il autre chose avec quoi je peux vous aider aujourd'hui ?"

### Expressions à éviter :
- Argot ou langage familier
- Promesses absolues ("c'est garanti")
- Informations non vérifiées
- Références à ta nature d'IA

IMPORTANT: Tu dois toujours recommander l'escalade vers un professionnel humain pour toute demande qui dépasse tes domaines d'expertise autorisés.`;
  }

  async createAssistant() {
    try {
      console.log('🤖 Création de l\'assistant Amani...');
      
      const assistant = await this.openai.beta.assistants.create({
        name: "Assistant Amani",
        instructions: this.systemPrompt,
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        tools: []
      });

      console.log('✅ Assistant Amani créé:', assistant.id);
      console.log('⚠️ Ajoutez ASSISTANT_AMANI_ID=' + assistant.id + ' à votre fichier .env');
      
      return assistant;
    } catch (error) {
      console.error('❌ Erreur création assistant:', error);
      return null;
    }
  }

  async getAssistantResponse(clientMessage, clientContext) {
    if (!this.openai) {
      throw new Error('OpenAI non initialisé');
    }

    try {
      // Vérifier si des professionnels sont connectés
      const professionnelsEnLigne = await this.checkOnlineProfessionals();
      
      if (professionnelsEnLigne > 0) {
        console.log(`⚠️ ${professionnelsEnLigne} professionnels en ligne - Assistant non activé`);
        return null; // L'assistant ne répond que si aucun professionnel n'est connecté
      }

      console.log('🤖 Assistant Amani activé - aucun professionnel en ligne');

      // Créer un thread pour cette conversation
      const thread = await this.openai.beta.threads.create();

      // Construire le contexte client
      const contextMessage = this.buildClientContext(clientContext);
      
      // Ajouter le contexte
      await this.openai.beta.threads.messages.create(thread.id, {
        role: "user",
        content: contextMessage
      });

      // Ajouter le message du client
      await this.openai.beta.threads.messages.create(thread.id, {
        role: "user", 
        content: clientMessage
      });

      // Exécuter l'assistant
      const run = await this.openai.beta.threads.runs.createAndPoll(thread.id, {
        assistant_id: this.assistantId || await this.getOrCreateAssistant(),
        max_completion_tokens: parseInt(process.env.ASSISTANT_MAX_TOKENS) || 500,
      });

      if (run.status === 'completed') {
        const messages = await this.openai.beta.threads.messages.list(thread.id);
        const assistantMessage = messages.data[0];
        
        if (assistantMessage.role === 'assistant') {
          const content = assistantMessage.content[0]?.text?.value;
          
          console.log('✅ Réponse Assistant Amani générée');
          
          return {
            message: content,
            shouldEscalate: this.shouldEscalateMessage(content, clientMessage),
            escalationReason: this.getEscalationReason(content, clientMessage),
            suggestedActions: this.getSuggestedActions(content, clientContext),
            clientContext: this.summarizeClientContext(clientContext)
          };
        }
      }

      throw new Error(`Run status: ${run.status}`);
      
    } catch (error) {
      console.error('❌ Erreur génération réponse assistant:', error);
      
      // Réponse de fallback
      return {
        message: "Je rencontre une difficulté technique temporaire. Je vais vous mettre en relation avec un membre de notre équipe dès que possible.",
        shouldEscalate: true,
        escalationReason: "Erreur technique de l'assistant",
        suggestedActions: ["escalate_to_human"],
        clientContext: this.summarizeClientContext(clientContext)
      };
    }
  }

  async getOrCreateAssistant() {
    if (this.assistantId) {
      return this.assistantId;
    }

    const assistant = await this.createAssistant();
    this.assistantId = assistant?.id;
    return this.assistantId;
  }

  buildClientContext(clientContext) {
    if (!clientContext) return "Nouveau client sans contexte particulier.";

    const context = [];
    
    if (clientContext.nom && clientContext.prenom) {
      context.push(`Client: ${clientContext.prenom} ${clientContext.nom}`);
    }
    
    if (clientContext.code_client) {
      context.push(`Code client: ${clientContext.code_client}`);
    }
    
    if (clientContext.entreprise) {
      context.push(`Entreprise: ${clientContext.entreprise}`);
    }

    if (clientContext.factures_recentes) {
      context.push(`Factures récentes: ${clientContext.factures_recentes.length} facture(s)`);
    }

    if (clientContext.derniere_conversation) {
      context.push(`Dernière conversation: ${clientContext.derniere_conversation}`);
    }

    return `CONTEXTE CLIENT:\n${context.join('\n')}\n\nMESSAGE CLIENT:`;
  }

  shouldEscalateMessage(assistantResponse, clientMessage) {
    const escalationKeywords = [
      'réclamation', 'plainte', 'insatisfait', 'problème grave',
      'urgent', 'directeur', 'responsable', 'remboursement',
      'annulation', 'modification facture', 'réduction', 'remise'
    ];

    const messageToCheck = (clientMessage + ' ' + assistantResponse).toLowerCase();
    
    return escalationKeywords.some(keyword => messageToCheck.includes(keyword));
  }

  getEscalationReason(assistantResponse, clientMessage) {
    if (this.shouldEscalateMessage(assistantResponse, clientMessage)) {
      return "Demande nécessitant une intervention humaine détectée";
    }
    return null;
  }

  getSuggestedActions(assistantResponse, clientContext) {
    const actions = [];
    
    if (assistantResponse.includes('facture')) {
      actions.push('show_invoices');
    }
    
    if (assistantResponse.includes('profil') || assistantResponse.includes('compte')) {
      actions.push('show_profile');
    }
    
    if (this.shouldEscalateMessage(assistantResponse, '')) {
      actions.push('escalate_to_human');
    }

    return actions;
  }

  summarizeClientContext(clientContext) {
    if (!clientContext) return "Contexte non disponible";
    
    return `Client: ${clientContext.prenom || ''} ${clientContext.nom || ''} (${clientContext.code_client || 'N/A'})`;
  }

  async checkOnlineProfessionals() {
    try {
      const result = await query(`
        SELECT COUNT(*) as count 
        FROM chat_participants cp
        WHERE cp.user_type = 'user' 
        AND cp.en_ligne = TRUE 
        AND cp.derniere_vue >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
      `);
      
      return result[0]?.count || 0;
    } catch (error) {
      console.error('❌ Erreur vérification professionnels en ligne:', error);
      return 0; // En cas d'erreur, considérer qu'aucun professionnel n'est en ligne
    }
  }

async getClientContext(clientId) {
  try {
    // Récupérer les informations client
    const clients = await query(`
      SELECT code_client, nom, prenom, entreprise, email, telephone 
      FROM clients 
      WHERE id = ? AND statut = 'actif' AND deleted_at IS NULL
    `, [clientId]);

    if (clients.length === 0) {
      return null;
    }

    const client = clients[0];

    // Récupérer les factures récentes
    const factures = await query(`
      SELECT numero_facture, montant_ttc, statut, date_creation 
      FROM factures 
      WHERE client_id = ? 
      ORDER BY date_creation DESC 
      LIMIT 5
    `, [clientId]);

    // Récupérer la dernière conversation
    const conversations = await query(`
      SELECT sujet, dernier_message, derniere_activite 
      FROM vue_conversations_chat 
      WHERE client_id = ? 
      ORDER BY derniere_activite DESC 
      LIMIT 1
    `, [clientId]);

    return {
      ...client,
      factures_recentes: factures,
      derniere_conversation: conversations[0]?.dernier_message || null
    };
  } catch (error) {
    console.error('❌ Erreur récupération contexte client:', error);
    return null;
  }
}

  // Méthode pour tester l'assistant
  async testAssistant() {
    try {
      const testMessage = "Bonjour, j'aimerais connaître le statut de ma facture.";
      const testContext = {
        nom: "Ngoupayou",
        prenom: "Jean", 
        code_client: "HILT001",
        entreprise: "Test Corp"
      };

      const response = await this.getAssistantResponse(testMessage, testContext);
      console.log('🧪 Test Assistant Amani:', response);
      return response;
    } catch (error) {
      console.error('❌ Erreur test assistant:', error);
      return null;
    }
  }

  isEnabled() {
    return process.env.ASSISTANT_ENABLED === 'true' && this.openai && (this.assistantId || process.env.ASSISTANT_AMANI_ID);
  }

  async getStats() {
    try {
      const professionnelsEnLigne = await this.checkOnlineProfessionals();
      
      return {
        enabled: this.isEnabled(),
        assistantId: this.assistantId || process.env.ASSISTANT_AMANI_ID || null,
        professionnelsEnLigne,
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Erreur stats assistant:', error);
      return {
        enabled: false,
        error: error.message
      };
    }
  }
}

// Instance singleton
const assistantAmaniService = new AssistantAmaniService();

module.exports = assistantAmaniService;