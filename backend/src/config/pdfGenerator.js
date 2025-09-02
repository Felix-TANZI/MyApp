const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Configuration du template
const TEMPLATE_CONFIG = {
  colors: {
    primary: '#0F4C8C',
    secondary: '#4299e1',
    text: '#1a202c',
    lightText: '#718096',
    border: '#e2e8f0'
  },
  fonts: {
    regular: 'Helvetica',
    bold: 'Helvetica-Bold',
    italic: 'Helvetica-Oblique'
  },
  spacing: {
    margin: 50,
    lineHeight: 20,
    sectionGap: 30
  }
};

class InvoicePDFGenerator {
  constructor() {
    this.doc = null;
    this.currentY = 0;
  }

  // Fonction principale pour générer le PDF
  async generateInvoicePDF(facture) {
    return new Promise((resolve, reject) => {
      try {
        this.doc = new PDFDocument({ 
          size: 'A4', 
          margin: TEMPLATE_CONFIG.spacing.margin,
          bufferPages: true
        });

        const buffers = [];
        this.doc.on('data', buffers.push.bind(buffers));
        this.doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });

        // Générer le contenu
        this.createHeader(facture);
        this.createInvoiceInfo(facture);
        this.createClientInfo(facture);
        this.createItemsTable(facture);
        this.createTotalsSection(facture);
        this.createFooter(facture);

        // Finaliser le document
        this.doc.end();

      } catch (error) {
        reject(error);
      }
    });
  }

  // En-tête avec logo et informations de l'hôtel
  createHeader(facture) {
    const { doc } = this;
    const pageWidth = doc.page.width - 2 * TEMPLATE_CONFIG.spacing.margin;
    
    // Titre principal
    doc.fontSize(24)
       .fillColor(TEMPLATE_CONFIG.colors.primary)
       .font(TEMPLATE_CONFIG.fonts.bold)
       .text('HILTON YAOUNDÉ', TEMPLATE_CONFIG.spacing.margin, 60);
    
    // Sous-titre
    doc.fontSize(12)
       .fillColor(TEMPLATE_CONFIG.colors.lightText)
       .font(TEMPLATE_CONFIG.fonts.regular)
       .text('Hôtel de luxe au cœur de Yaoundé', TEMPLATE_CONFIG.spacing.margin, 90);
    
    // Informations de contact à droite
    const contactX = doc.page.width - TEMPLATE_CONFIG.spacing.margin - 200;
    doc.fontSize(10)
       .fillColor(TEMPLATE_CONFIG.colors.text)
       .text('Boulevard du 20 Mai', contactX, 60)
       .text('Yaoundé, Cameroun', contactX, 75)
       .text('Tél: +237 222 XXX XXX', contactX, 90)
       .text('Email: contact@hilton-yaounde.com', contactX, 105);

    // Ligne de séparation
    this.currentY = 140;
    doc.strokeColor(TEMPLATE_CONFIG.colors.border)
       .lineWidth(2)
       .moveTo(TEMPLATE_CONFIG.spacing.margin, this.currentY)
       .lineTo(doc.page.width - TEMPLATE_CONFIG.spacing.margin, this.currentY)
       .stroke();
    
    this.currentY += 30;
  }

  // Informations de la facture (numéro, dates, etc.)
  createInvoiceInfo(facture) {
    const { doc } = this;
    
    // Titre "FACTURE" centré
    doc.fontSize(20)
       .fillColor(TEMPLATE_CONFIG.colors.primary)
       .font(TEMPLATE_CONFIG.fonts.bold)
       .text('FACTURE', 0, this.currentY, { align: 'center', width: doc.page.width });
    
    this.currentY += 40;
    
    // Informations de la facture dans un encadré
    const infoBoxY = this.currentY;
    const infoBoxHeight = 80;
    
    // Fond de l'encadré
    doc.rect(TEMPLATE_CONFIG.spacing.margin, infoBoxY, 
             doc.page.width - 2 * TEMPLATE_CONFIG.spacing.margin, infoBoxHeight)
       .fillColor('#f8fafc')
       .fill();
    
    // Bordure de l'encadré
    doc.rect(TEMPLATE_CONFIG.spacing.margin, infoBoxY, 
             doc.page.width - 2 * TEMPLATE_CONFIG.spacing.margin, infoBoxHeight)
       .strokeColor(TEMPLATE_CONFIG.colors.border)
       .lineWidth(1)
       .stroke();
    
    // Contenu de l'encadré - partie gauche
    const leftX = TEMPLATE_CONFIG.spacing.margin + 20;
    const rightX = doc.page.width - TEMPLATE_CONFIG.spacing.margin - 180;
    
    doc.fontSize(12)
       .fillColor(TEMPLATE_CONFIG.colors.text)
       .font(TEMPLATE_CONFIG.fonts.bold)
       .text('Numéro de facture:', leftX, infoBoxY + 15)
       .font(TEMPLATE_CONFIG.fonts.regular)
       .text(facture.numero_facture, leftX, infoBoxY + 32);
    
    doc.font(TEMPLATE_CONFIG.fonts.bold)
       .text('Type:', leftX, infoBoxY + 50)
       .font(TEMPLATE_CONFIG.fonts.regular)
       .text(this.getTypeLabel(facture.type_facture), leftX, infoBoxY + 65);
    
    // Contenu de l'encadré - partie droite
    doc.font(TEMPLATE_CONFIG.fonts.bold)
       .text('Date de facture:', rightX, infoBoxY + 15)
       .font(TEMPLATE_CONFIG.fonts.regular)
       .text(this.formatDate(facture.date_facture), rightX, infoBoxY + 32);
    
    doc.font(TEMPLATE_CONFIG.fonts.bold)
       .text('Date d\'échéance:', rightX, infoBoxY + 50)
       .font(TEMPLATE_CONFIG.fonts.regular)
       .text(this.formatDate(facture.date_echeance), rightX, infoBoxY + 65);
    
    this.currentY = infoBoxY + infoBoxHeight + 30;
  }

  // Informations du client
  createClientInfo(facture) {
    const { doc } = this;
    
    // Titre section client
    doc.fontSize(14)
       .fillColor(TEMPLATE_CONFIG.colors.primary)
       .font(TEMPLATE_CONFIG.fonts.bold)
       .text('FACTURÉ À', TEMPLATE_CONFIG.spacing.margin, this.currentY);
    
    this.currentY += 25;
    
    // Informations client
    doc.fontSize(11)
       .fillColor(TEMPLATE_CONFIG.colors.text)
       .font(TEMPLATE_CONFIG.fonts.bold)
       .text(`${facture.client_nom} ${facture.client_prenom}`, TEMPLATE_CONFIG.spacing.margin, this.currentY);
    
    this.currentY += 15;
    
    if (facture.entreprise) {
      doc.font(TEMPLATE_CONFIG.fonts.regular)
         .text(facture.entreprise, TEMPLATE_CONFIG.spacing.margin, this.currentY);
      this.currentY += 15;
    }
    
    doc.text(facture.client_email, TEMPLATE_CONFIG.spacing.margin, this.currentY);
    this.currentY += 15;
    
    if (facture.client_telephone) {
      doc.text(facture.client_telephone, TEMPLATE_CONFIG.spacing.margin, this.currentY);
      this.currentY += 15;
    }
    
    if (facture.client_adresse) {
      doc.text(facture.client_adresse, TEMPLATE_CONFIG.spacing.margin, this.currentY);
      this.currentY += 15;
    }
    
    doc.text(`${facture.client_ville}, ${facture.client_pays}`, TEMPLATE_CONFIG.spacing.margin, this.currentY);
    this.currentY += 30;

    // Message client
    if (facture.message_client) {
      doc.fontSize(10)
         .fillColor(TEMPLATE_CONFIG.colors.lightText)
         .font(TEMPLATE_CONFIG.fonts.italic)
         .text(`Note: ${facture.message_client}`, TEMPLATE_CONFIG.spacing.margin, this.currentY, {
           width: doc.page.width - 2 * TEMPLATE_CONFIG.spacing.margin,
           align: 'justify'
         });
      this.currentY += 30;
    }
  }

  // Tableau des lignes de facture
  createItemsTable(facture) {
    const { doc } = this;
    const tableWidth = doc.page.width - 2 * TEMPLATE_CONFIG.spacing.margin;
    const tableX = TEMPLATE_CONFIG.spacing.margin;
    
    // Dimensions des colonnes
    const cols = {
      designation: { width: tableWidth * 0.35, x: tableX },
      description: { width: tableWidth * 0.25, x: 0 },
      quantite: { width: tableWidth * 0.10, x: 0 },
      prix: { width: tableWidth * 0.15, x: 0 },
      montant: { width: tableWidth * 0.15, x: 0 }
    };
    
    // Calculer les positions X
    cols.description.x = cols.designation.x + cols.designation.width;
    cols.quantite.x = cols.description.x + cols.description.width;
    cols.prix.x = cols.quantite.x + cols.quantite.width;
    cols.montant.x = cols.prix.x + cols.prix.width;
    
    // En-tête du tableau
    const headerY = this.currentY;
    const headerHeight = 30;
    
    // Fond de l'en-tête
    doc.rect(tableX, headerY, tableWidth, headerHeight)
       .fillColor(TEMPLATE_CONFIG.colors.primary)
       .fill();
    
    // Textes de l'en-tête
    doc.fontSize(11)
       .fillColor('white')
       .font(TEMPLATE_CONFIG.fonts.bold);
    
    const headerTextY = headerY + 10;
    doc.text('Désignation', cols.designation.x + 5, headerTextY)
       .text('Description', cols.description.x + 5, headerTextY)
       .text('Qté', cols.quantite.x + 5, headerTextY)
       .text('Prix unitaire', cols.prix.x + 5, headerTextY)
       .text('Montant', cols.montant.x + 5, headerTextY);
    
    this.currentY = headerY + headerHeight;
    
    // Lignes du tableau
    doc.fontSize(10)
       .fillColor(TEMPLATE_CONFIG.colors.text)
       .font(TEMPLATE_CONFIG.fonts.regular);
    
    facture.lignes.forEach((ligne, index) => {
      const rowHeight = Math.max(40, this.calculateRowHeight(ligne));
      const isEven = index % 2 === 0;
      
      // Fond alterné
      if (isEven) {
        doc.rect(tableX, this.currentY, tableWidth, rowHeight)
           .fillColor('#f9fafb')
           .fill();
      }
      
      // Bordures des cellules
      doc.rect(tableX, this.currentY, tableWidth, rowHeight)
         .strokeColor(TEMPLATE_CONFIG.colors.border)
         .lineWidth(0.5)
         .stroke();
      
      const textY = this.currentY + 8;
      const cellPadding = 5;
      
      // Contenu des cellules
      doc.fillColor(TEMPLATE_CONFIG.colors.text);
      
      // Désignation
      doc.font(TEMPLATE_CONFIG.fonts.bold)
         .text(ligne.designation, cols.designation.x + cellPadding, textY, {
           width: cols.designation.width - 2 * cellPadding,
           height: rowHeight - 16
         });
      
      // Description
      doc.font(TEMPLATE_CONFIG.fonts.regular)
         .text(ligne.description || '', cols.description.x + cellPadding, textY, {
           width: cols.description.width - 2 * cellPadding,
           height: rowHeight - 16
         });
      
      // Quantité
      doc.text(ligne.quantite.toString(), cols.quantite.x + cellPadding, textY, {
        width: cols.quantite.width - 2 * cellPadding,
        align: 'center'
      });
      
      // Prix unitaire
      doc.text(this.formatCurrency(ligne.prix_unitaire), cols.prix.x + cellPadding, textY, {
        width: cols.prix.width - 2 * cellPadding,
        align: 'right'
      });
      
      // Montant
      doc.font(TEMPLATE_CONFIG.fonts.bold)
         .text(this.formatCurrency(ligne.montant_ligne), cols.montant.x + cellPadding, textY, {
           width: cols.montant.width - 2 * cellPadding,
           align: 'right'
         });
      
      this.currentY += rowHeight;
    });
    
    this.currentY += 20;
  }

  // Section des totaux
  createTotalsSection(facture) {
    const { doc } = this;
    const totalsWidth = 250;
    const totalsX = doc.page.width - TEMPLATE_CONFIG.spacing.margin - totalsWidth;
    
    // Encadré des totaux
    const totalsBoxY = this.currentY;
    const totalsBoxHeight = 90;
    
    // Fond
    doc.rect(totalsX, totalsBoxY, totalsWidth, totalsBoxHeight)
       .fillColor('#f8fafc')
       .fill();
    
    // Bordure
    doc.rect(totalsX, totalsBoxY, totalsWidth, totalsBoxHeight)
       .strokeColor(TEMPLATE_CONFIG.colors.border)
       .lineWidth(1)
       .stroke();
    
    // Lignes de totaux
    const lineHeight = 20;
    const textX = totalsX + 15;
    const amountX = totalsX + totalsWidth - 15;
    let lineY = totalsBoxY + 15;
    
    doc.fontSize(11)
       .fillColor(TEMPLATE_CONFIG.colors.text)
       .font(TEMPLATE_CONFIG.fonts.regular);
    
    // Montant HT
    doc.text('Montant HT :', textX, lineY)
       .text(this.formatCurrency(facture.montant_ht), amountX, lineY, { align: 'right', width: 0 });
    lineY += lineHeight;
    
    // TVA
    doc.text(`TVA (${facture.taux_tva}%) :`, textX, lineY)
       .text(this.formatCurrency(facture.montant_tva), amountX, lineY, { align: 'right', width: 0 });
    lineY += lineHeight;
    
    // Ligne de séparation
    doc.strokeColor(TEMPLATE_CONFIG.colors.primary)
       .lineWidth(1)
       .moveTo(textX, lineY + 5)
       .lineTo(amountX, lineY + 5)
       .stroke();
    lineY += 15;
    
    // Total TTC
    doc.fontSize(13)
       .font(TEMPLATE_CONFIG.fonts.bold)
       .fillColor(TEMPLATE_CONFIG.colors.primary)
       .text('Total TTC :', textX, lineY)
       .text(this.formatCurrency(facture.montant_ttc), amountX, lineY, { align: 'right', width: 0 });
    
    this.currentY = totalsBoxY + totalsBoxHeight + 30;
  }

  // Pied de page avec mentions infos de paiement
  createFooter(facture) {
    const { doc } = this;
    const footerY = doc.page.height - 150;
    
    // Informations de paiement si facture payée
    if (facture.statut === 'payee' && facture.date_paiement) {
      doc.fontSize(11)
         .fillColor(TEMPLATE_CONFIG.colors.primary)
         .font(TEMPLATE_CONFIG.fonts.bold)
         .text('INFORMATIONS DE PAIEMENT', TEMPLATE_CONFIG.spacing.margin, footerY);
      
      let paymentY = footerY + 20;
      doc.fontSize(10)
         .fillColor(TEMPLATE_CONFIG.colors.text)
         .font(TEMPLATE_CONFIG.fonts.regular)
         .text(`Payé le : ${this.formatDate(facture.date_paiement)}`, TEMPLATE_CONFIG.spacing.margin, paymentY);
      
      if (facture.mode_paiement) {
        paymentY += 15;
        doc.text(`Mode de paiement : ${this.formatPaymentMode(facture.mode_paiement)}`, TEMPLATE_CONFIG.spacing.margin, paymentY);
      }
      
      if (facture.reference_paiement) {
        paymentY += 15;
        doc.text(`Référence : ${facture.reference_paiement}`, TEMPLATE_CONFIG.spacing.margin, paymentY);
      }
    }
    
    // Mentions légales en bas de page
    const legalY = doc.page.height - 80;
    
    // Ligne de séparation
    doc.strokeColor(TEMPLATE_CONFIG.colors.border)
       .lineWidth(1)
       .moveTo(TEMPLATE_CONFIG.spacing.margin, legalY - 10)
       .lineTo(doc.page.width - TEMPLATE_CONFIG.spacing.margin, legalY - 10)
       .stroke();
    
    doc.fontSize(8)
       .fillColor(TEMPLATE_CONFIG.colors.lightText)
       .font(TEMPLATE_CONFIG.fonts.regular)
       .text('Hilton Yaoundé - RCCM: XXX - NIU: XXX', TEMPLATE_CONFIG.spacing.margin, legalY, {
         width: doc.page.width - 2 * TEMPLATE_CONFIG.spacing.margin,
         align: 'center'
       })
       .text('TVA incluse selon la législation camerounaise en vigueur', TEMPLATE_CONFIG.spacing.margin, legalY + 12, {
         width: doc.page.width - 2 * TEMPLATE_CONFIG.spacing.margin,
         align: 'center'
       })
       .text(`Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, 
              TEMPLATE_CONFIG.spacing.margin, legalY + 24, {
         width: doc.page.width - 2 * TEMPLATE_CONFIG.spacing.margin,
         align: 'center'
       });
  }

  // Fonctions utilitaires
  calculateRowHeight(ligne) {
    // Calcul approximatif basé sur la longueur du texte
    const designationLines = Math.ceil(ligne.designation.length / 40);
    const descriptionLines = ligne.description ? Math.ceil(ligne.description.length / 35) : 1;
    const maxLines = Math.max(designationLines, descriptionLines, 1);
    return Math.max(40, maxLines * 15 + 10);
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  }

  formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  getTypeLabel(type) {
    const types = {
      'hebergement': 'Hébergement',
      'restauration': 'Restauration',
      'evenement': 'Événement',
      'autre': 'Autre'
    };
    return types[type] || 'Non spécifié';
  }

  formatPaymentMode(mode) {
    const modes = {
      'especes': 'Espèces',
      'carte_bancaire': 'Carte bancaire',
      'virement': 'Virement bancaire',
      'cheque': 'Chèque',
      'mobile_money': 'Mobile Money'
    };
    return modes[mode] || mode;
  }
}

// Fonction principale exportée
async function generateInvoicePDF(facture) {
  const generator = new InvoicePDFGenerator();
  return await generator.generateInvoicePDF(facture);
}

// Configuration modifiable du template
const updateTemplateConfig = (newConfig) => {
  Object.assign(TEMPLATE_CONFIG, newConfig);
};

module.exports = {
  generateInvoicePDF,
  updateTemplateConfig,
  TEMPLATE_CONFIG,
  InvoicePDFGenerator
};