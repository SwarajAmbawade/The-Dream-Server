class User {
  constructor(row) {
    this.id = row.id;
    this.username = row.username;
    this.credits = row.credits;
    this.createdAt = row.created_at;
  }

  toJSON() {
    return {
      id: this.id,
      username: this.username,
      credits: this.credits,
      createdAt: this.createdAt,
    };
  }
}

module.exports = User;
