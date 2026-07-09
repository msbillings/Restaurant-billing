// Session Manager - Tracks active user sessions for concurrent login limiting
class SessionManager {
  constructor() {
    // Map of userId -> Set of active tokens
    this.activeSessions = new Map();
    // Map of userId -> max logins for that user
    this.userMaxLogins = new Map();
    // Default max concurrent logins per user (configurable via env)
    this.maxConcurrentLogins = parseInt(process.env.MAX_CONCURRENT_LOGINS || '1', 10);
  }

  /**
   * Set max concurrent logins for a specific user
   * @param {string} userId - User ID
   * @param {number} maxLogins - Max logins for this user
   */
  setUserMaxLogins(userId, maxLogins) {
    this.userMaxLogins.set(userId, maxLogins);
  }

  /**
   * Add a new session for a user
   * @param {string} userId - User ID
   * @param {string} token - JWT token
   * @returns {boolean} - True if session added, false if limit reached
   */
  addSession(userId, token) {
    if (!this.activeSessions.has(userId)) {
      this.activeSessions.set(userId, new Set());
    }

    const userSessions = this.activeSessions.get(userId);
    const maxLogins = this.userMaxLogins.get(userId) || this.maxConcurrentLogins;

    // Check if limit reached
    if (userSessions.size >= maxLogins) {
      return false;
    }

    userSessions.add(token);
    return true;
  }

  /**
   * Remove a session for a user
   * @param {string} userId - User ID
   * @param {string} token - JWT token to remove
   */
  removeSession(userId, token) {
    if (this.activeSessions.has(userId)) {
      const userSessions = this.activeSessions.get(userId);
      userSessions.delete(token);

      // Clean up empty sets
      if (userSessions.size === 0) {
        this.activeSessions.delete(userId);
      }
    }
  }

  /**
   * Remove all sessions for a user
   * @param {string} userId - User ID
   */
  removeAllSessions(userId) {
    this.activeSessions.delete(userId);
  }

  /**
   * Check if user can login (hasn't reached limit)
   * @param {string} userId - User ID
   * @returns {boolean} - True if user can login
   */
  canLogin(userId) {
    if (!this.activeSessions.has(userId)) {
      return true;
    }

    const userSessions = this.activeSessions.get(userId);
    const maxLogins = this.userMaxLogins.get(userId) || this.maxConcurrentLogins;
    return userSessions.size < maxLogins;
  }

  /**
   * Get active session count for a user
   * @param {string} userId - User ID
   * @returns {number} - Number of active sessions
   */
  getActiveSessionCount(userId) {
    if (!this.activeSessions.has(userId)) {
      return 0;
    }
    return this.activeSessions.get(userId).size;
  }

  /**
   * Get max concurrent logins limit for a user
   * @param {string} userId - User ID
   * @returns {number} - Max concurrent logins allowed for this user
   */
  getUserMaxLogins(userId) {
    return this.userMaxLogins.get(userId) || this.maxConcurrentLogins;
  }

  /**
   * Get default max concurrent logins limit
   * @returns {number} - Default max concurrent logins allowed
   */
  getMaxConcurrentLogins() {
    return this.maxConcurrentLogins;
  }

  /**
   * Clear all sessions (for development/testing)
   */
  clearAllSessions() {
    this.activeSessions.clear();
    this.userMaxLogins.clear();
  }
}

// Export singleton instance
export default new SessionManager();

