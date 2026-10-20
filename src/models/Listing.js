class Listing {
  constructor({ dreamId, sellerId, salePrice, rentPrice }) {
    this.dreamId = dreamId;
    this.sellerId = sellerId;
    this.salePrice = salePrice;
    this.rentPrice = rentPrice;
  }

  validate() {
    const validSalePrice = Number.isSafeInteger(this.salePrice) && this.salePrice >= 0;
    const validRentPrice = Number.isSafeInteger(this.rentPrice) && this.rentPrice >= 0;

    if (!validSalePrice || !validRentPrice) {
      throw new Error('Prices must be non-negative whole credits.');
    }
  }
}

module.exports = Listing;
