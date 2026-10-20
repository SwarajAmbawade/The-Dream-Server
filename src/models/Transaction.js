const VALID_TYPES = new Set(['purchase', 'rental', 'welcome_credit']);

class Transaction {
  constructor({ userId, dreamId, type, amount }) {
    this.userId = userId;
    this.dreamId = dreamId;
    this.type = type;
    this.amount = amount;
  }

  validate() {
    if (!VALID_TYPES.has(this.type)) {
      throw new Error('Invalid transaction type.');
    }

    if (!Number.isSafeInteger(this.amount)) {
      throw new Error('Transaction amount must be a whole number.');
    }
  }
}

module.exports = Transaction;
