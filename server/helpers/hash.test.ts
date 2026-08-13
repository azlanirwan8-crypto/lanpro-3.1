import { hashPassword, verifyPassword } from './hash';

describe('hashPassword / verifyPassword', () => {
  it('bcrypt hash round-trips correctly', async () => {
    const hash = hashPassword('correct-horse-battery-staple');
    expect(await verifyPassword('correct-horse-battery-staple', hash)).toBe(true);
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('verifies legacy pbkdf2 hashes correctly', async () => {
    const crypto = require('crypto');
    const salt = crypto.randomBytes(16).toString('hex');
    const iterations = 10000;
    const derived = crypto.pbkdf2Sync('my-password', salt, iterations, 64, 'sha512').toString('hex');
    const pbkdf2Hash = `pbkdf2$${iterations}$${salt}$${derived}`;

    expect(await verifyPassword('my-password', pbkdf2Hash)).toBe(true);
    expect(await verifyPassword('not-my-password', pbkdf2Hash)).toBe(false);
  });

  // Regression tests for the auth-bypass backdoor removed in the security audit:
  // verifyPassword() used to accept 'admin123'/'password'/'123456'/'lanpro123'/'admin',
  // password === username, or the literal hash 'firebase-auth-placeholder' as always-valid
  // for any hash that wasn't recognized bcrypt/pbkdf2. All of these must now be rejected.
  describe('backdoor removal (security regression)', () => {
    const unrecognizedHash = 'some-legacy-value-not-bcrypt-or-pbkdf2';

    it.each(['admin123', 'password', '123456', 'lanpro123', 'admin'])(
      'rejects former backdoor password %p against an unrecognized hash',
      async (backdoorPassword) => {
        expect(await verifyPassword(backdoorPassword, unrecognizedHash)).toBe(false);
      }
    );

    it('rejects password === username against an unrecognized hash', async () => {
      expect(await verifyPassword('someuser', unrecognizedHash)).toBe(false);
    });

    it('rejects ANY password when the stored hash is the firebase-auth-placeholder sentinel', async () => {
      expect(await verifyPassword('anything-at-all', 'firebase-auth-placeholder')).toBe(false);
      expect(await verifyPassword('admin123', 'firebase-auth-placeholder')).toBe(false);
    });

    it('rejects any password when the stored hash is empty/null', async () => {
      expect(await verifyPassword('anything', '')).toBe(false);
      expect(await verifyPassword('anything', null as unknown as string)).toBe(false);
    });

    it('does not fall back to plain-text equality for unrecognized hashes', async () => {
      // Only bcrypt/pbkdf2 formats should ever verify true — a hash column that
      // literally contains the password in plain text must not verify either,
      // since that was part of the same removed fallback behavior.
      expect(await verifyPassword('literal-value', 'literal-value')).toBe(false);
    });
  });
});
