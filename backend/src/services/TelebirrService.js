const axios = require('axios');

class TelebirrService {
  constructor() {
    // Target receiver number (the business Telebirr number)
    this.TARGET_RECEIVER = "+251910553674";
    this.EXPECTED_RECEIVER_NAME = "Tinsae Mulugeta";
    // Store used transaction IDs to prevent replay attacks
    this.usedTransactions = new Set();
  }

  // Extract data from SMS text
  extractFromSMS(text) {
    if (!text) return null;

    // Extract amount (ETB amount)
    const amountMatch = text.match(/ETB\s*([\d,.]+)/i);
    // Extract receiver name (after "to" and before parentheses)
    const receiverMatch = text.match(/to\s+([A-Za-z\s]+?)\s*\(/i);
    // Extract transaction ID/number
    const txMatch = text.match(/transaction number is\s*([A-Z0-9]+)/i);

    return {
      amount: amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null,
      receiverName: receiverMatch ? receiverMatch[1].trim() : null,
      transactionId: txMatch ? txMatch[1].trim() : null
    };
  }

  // Validate SMS against expected values
  validateSMS(smsText) {
    console.log('Validating SMS:', smsText);
    
    const data = this.extractFromSMS(smsText);
    if (!data) {
      return { valid: false, reason: "Could not parse SMS format" };
    }

    // Check if transaction already used
    if (this.usedTransactions.has(data.transactionId)) {
      return { valid: false, reason: "Transaction already used" };
    }

    // Check receiver name matches
    const nameMatch = data.receiverName && 
      data.receiverName.toLowerCase() === this.EXPECTED_RECEIVER_NAME.toLowerCase();

    if (nameMatch && data.amount && data.transactionId) {
      // Mark transaction as used
      this.usedTransactions.add(data.transactionId);
      
      return {
        valid: true,
        amount: data.amount,
        transactionId: data.transactionId,
        receiverName: data.receiverName
      };
    }

    return {
      valid: false,
      reason: "Receiver name mismatch or invalid SMS format"
    };
  }

  // Verify receipt via API (optional - if you want to call the receipt API)
  async verifyReceiptViaAPI(receiptId) {
    try {
      const receiptUrl = `https://transactioninfo.ethiotelecom.et/receipt/${receiptId}`;
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(receiptUrl)}`;
      
      const response = await axios.get(proxyUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      });
      
      if (response.status === 200 && response.data) {
        const htmlContent = response.data;
        
        // Parse HTML to extract receipt data
        const extracted = this.extractReceiptData(htmlContent);
        
        if (extracted && extracted.transactionStatus === 'Completed') {
          // Check receiver match
          const receiverMatch = this.isReceiverMatch(
            this.TARGET_RECEIVER, 
            extracted.creditedNumber
          );
          
          if (receiverMatch && extracted.settledAmount) {
            return {
              valid: true,
              amount: extracted.settledAmount,
              receiptData: extracted
            };
          }
        }
      }
      
      return { valid: false, reason: "Receipt verification failed" };
    } catch (error) {
      console.error('Receipt verification error:', error);
      return { valid: false, reason: "Could not verify receipt" };
    }
  }

  // Extract receipt data from HTML
  extractReceiptData(htmlContent) {
    const creditedPatterns = [
      /Credited party account no\s*([0-9\*]+)/i,
      /የገንዘብ ተቀባይ ቱሌብር ቁ\.\s*([0-9\*]+)/i
    ];
    
    let creditedNumber = null;
    for (let pattern of creditedPatterns) {
      const match = htmlContent.match(pattern);
      if (match && match[1]) {
        creditedNumber = match[1].trim();
        break;
      }
    }
    
    // Extract amount
    const amountPatterns = [
      /Settled Amount\s*([\d,]+\.?\d*)\s*Birr/i,
      /የተከፈለው መጠን\s*([\d,]+\.?\d*)\s*Birr/i
    ];
    
    let settledAmount = null;
    for (let pattern of amountPatterns) {
      const match = htmlContent.match(pattern);
      if (match && match[1]) {
        settledAmount = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(settledAmount)) break;
      }
    }
    
    // Extract status
    const statusPatterns = [
      /transaction status\s*([A-Za-z]+)/i,
      /የከፍያው ሁኔታ\s*([A-Za-z]+)/i
    ];
    
    let transactionStatus = null;
    for (let pattern of statusPatterns) {
      const match = htmlContent.match(pattern);
      if (match && match[1]) {
        transactionStatus = match[1].trim();
        break;
      }
    }
    
    return {
      creditedNumber,
      settledAmount,
      transactionStatus
    };
  }

  // Compare receiver phone numbers
  isReceiverMatch(targetPhone, creditedNumberRaw) {
    if (!creditedNumberRaw) return false;
    
    const cleanTarget = targetPhone.replace(/[^\d]/g, '');
    const cleanCredited = creditedNumberRaw.replace(/[^\d]/g, '');
    
    if (cleanCredited.length === 0) return false;
    
    // Exact match
    if (cleanTarget === cleanCredited) return true;
    
    // Last 6 digits match (for masked numbers)
    const targetLast6 = cleanTarget.slice(-6);
    const creditedLast6 = cleanCredited.slice(-6);
    if (targetLast6 === creditedLast6 && targetLast6.length === 6) return true;
    
    // Substring match
    if (cleanTarget.includes(cleanCredited) && cleanCredited.length >= 5) return true;
    if (cleanCredited.includes(cleanTarget) && cleanTarget.length >= 5) return true;
    
    return false;
  }

  // Clear used transactions (optional, for testing)
  clearUsedTransactions() {
    this.usedTransactions.clear();
  }
}

module.exports = new TelebirrService();