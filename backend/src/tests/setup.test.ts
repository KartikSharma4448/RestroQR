import { fc } from './helpers/fast-check';
import { generateTestToken, generateOwnerToken, generateAdminToken, authHeader } from './helpers/auth';

describe('Testing Framework Setup', () => {
  it('should run a basic Jest test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should support fast-check property-based testing', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        expect(a + b).toBe(b + a);
      }),
      { numRuns: 100 }
    );
  });

  describe('Auth Token Generator', () => {
    it('should generate a valid JWT format token', () => {
      const token = generateTestToken({ sub: 'test-user-id', role: 'owner' });
      const parts = token.split('.');
      expect(parts).toHaveLength(3);

      // Verify header
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
      expect(header).toEqual({ alg: 'HS256', typ: 'JWT' });

      // Verify payload
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      expect(payload.sub).toBe('test-user-id');
      expect(payload.role).toBe('owner');
      expect(payload.iat).toBeDefined();
      expect(payload.exp).toBeDefined();
      expect(payload.exp).toBeGreaterThan(payload.iat);
    });

    it('should generate owner tokens', () => {
      const token = generateOwnerToken('owner-123', 'test@example.com');
      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      expect(payload.sub).toBe('owner-123');
      expect(payload.role).toBe('owner');
      expect(payload.email).toBe('test@example.com');
    });

    it('should generate admin tokens', () => {
      const token = generateAdminToken('admin-456');
      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      expect(payload.sub).toBe('admin-456');
      expect(payload.role).toBe('admin');
    });

    it('should format auth header correctly', () => {
      const token = 'some-token';
      expect(authHeader(token)).toBe('Bearer some-token');
    });
  });
});
