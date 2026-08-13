import bcrypt from "bcryptjs";
import crypto from "crypto";

export const hashPassword = (password: string): string => {
  return bcrypt.hashSync(password, 10);
};

export const verifyPassword = async (password: string, storedHash: string, username?: string): Promise<boolean> => {
  const cleanHash = storedHash ? storedHash.trim() : '';

  // Support legacy/existing pbkdf2 database records
  if (cleanHash.startsWith('pbkdf2$')) {
    try {
      const parts = cleanHash.split('$');
      if (parts.length !== 4) return false;
      const iterations = parseInt(parts[1], 10);
      const salt = parts[2];
      const originalHash = parts[3];
      const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
      
      // Prevent timing attacks using timingSafeEqual
      const hashBuf = Buffer.from(hash, 'hex');
      const originalBuf = Buffer.from(originalHash, 'hex');
      if (hashBuf.length !== originalBuf.length) return false;
      return crypto.timingSafeEqual(hashBuf, originalBuf);
    } catch (err) {
      console.error("Error during pbkdf2 verification:", err);
      return false;
    }
  }

  // Standard/Secure Bcrypt comparison for newer hashes
  if (cleanHash.startsWith('$2a$') || cleanHash.startsWith('$2b$') || cleanHash.startsWith('$2y$')) {
    try {
      return await bcrypt.compare(password, cleanHash);
    } catch (err) {
      console.error("Error during bcrypt verification:", err);
      return false;
    }
  }

  // No recognized hash format (bcrypt/pbkdf2) — reject rather than fall back to
  // placeholder/plain-text/hardcoded-password matches.
  return false;
};
