import script from '../src/script.mjs';

describe('HashiCorp Boundary Add User to Group Script', () => {
  const mockContext = {
    env: {
      ENVIRONMENT: 'test'
    },
    secrets: {
      BOUNDARY_USERNAME: 'testuser',
      BOUNDARY_PASSWORD: 'testpass',
      BOUNDARY_BASE_URL: 'https://boundary.example.com'
    },
    outputs: {}
  };

  beforeEach(() => {
    // Mock console to avoid noise in tests
    global.console.log = () => {};
    global.console.error = () => {};
  });

  describe('invoke handler', () => {
    test('should throw error for missing groupId', async () => {
      const params = {
        userId: 'u_1234567890',
        authMethodId: 'ampw_1234567890'
      };

      await expect(script.invoke(params, mockContext))
        .rejects.toThrow('Invalid or missing groupId parameter');
    });

    test('should throw error for missing userId', async () => {
      const params = {
        groupId: 'g_1234567890',
        authMethodId: 'ampw_1234567890'
      };

      await expect(script.invoke(params, mockContext))
        .rejects.toThrow('Invalid or missing userId parameter');
    });

    test('should throw error for missing authMethodId', async () => {
      const params = {
        groupId: 'g_1234567890',
        userId: 'u_1234567890'
      };

      await expect(script.invoke(params, mockContext))
        .rejects.toThrow('Invalid or missing authMethodId parameter');
    });

    test('should throw error for missing BOUNDARY_USERNAME', async () => {
      const params = {
        groupId: 'g_1234567890',
        userId: 'u_1234567890',
        authMethodId: 'ampw_1234567890'
      };

      const contextWithoutUsername = {
        ...mockContext,
        secrets: {
          BOUNDARY_PASSWORD: 'testpass',
          BOUNDARY_BASE_URL: 'https://boundary.example.com'
        }
      };

      await expect(script.invoke(params, contextWithoutUsername))
        .rejects.toThrow('Missing required secrets: BOUNDARY_USERNAME and BOUNDARY_PASSWORD');
    });

    test('should throw error for missing BOUNDARY_PASSWORD', async () => {
      const params = {
        groupId: 'g_1234567890',
        userId: 'u_1234567890',
        authMethodId: 'ampw_1234567890'
      };

      const contextWithoutPassword = {
        ...mockContext,
        secrets: {
          BOUNDARY_USERNAME: 'testuser',
          BOUNDARY_BASE_URL: 'https://boundary.example.com'
        }
      };

      await expect(script.invoke(params, contextWithoutPassword))
        .rejects.toThrow('Missing required secrets: BOUNDARY_USERNAME and BOUNDARY_PASSWORD');
    });

    test('should throw error for missing BOUNDARY_BASE_URL', async () => {
      const params = {
        groupId: 'g_1234567890',
        userId: 'u_1234567890',
        authMethodId: 'ampw_1234567890'
      };

      const contextWithoutBaseUrl = {
        ...mockContext,
        secrets: {
          BOUNDARY_USERNAME: 'testuser',
          BOUNDARY_PASSWORD: 'testpass'
        }
      };

      await expect(script.invoke(params, contextWithoutBaseUrl))
        .rejects.toThrow('Missing required secret: BOUNDARY_BASE_URL');
    });

    test('should validate empty groupId', async () => {
      const params = {
        groupId: '   ',
        userId: 'u_1234567890',
        authMethodId: 'ampw_1234567890'
      };

      await expect(script.invoke(params, mockContext))
        .rejects.toThrow('Invalid or missing groupId parameter');
    });

    test('should validate empty userId', async () => {
      const params = {
        groupId: 'g_1234567890',
        userId: '   ',
        authMethodId: 'ampw_1234567890'
      };

      await expect(script.invoke(params, mockContext))
        .rejects.toThrow('Invalid or missing userId parameter');
    });

    test('should validate empty authMethodId', async () => {
      const params = {
        groupId: 'g_1234567890',
        userId: 'u_1234567890',
        authMethodId: '   '
      };

      await expect(script.invoke(params, mockContext))
        .rejects.toThrow('Invalid or missing authMethodId parameter');
    });

    // Note: Testing actual Boundary API calls would require mocking fetch
    // or integration tests with real Boundary credentials
  });

  describe('error handler', () => {
    test('should re-throw error for framework to handle', async () => {
      const params = {
        groupId: 'g_1234567890',
        userId: 'u_1234567890',
        authMethodId: 'ampw_1234567890',
        error: new Error('Network timeout')
      };

      await expect(script.error(params, mockContext))
        .rejects.toThrow('Network timeout');
    });
  });

  describe('halt handler', () => {
    test('should handle graceful shutdown', async () => {
      const params = {
        groupId: 'g_1234567890',
        userId: 'u_1234567890',
        authMethodId: 'ampw_1234567890',
        reason: 'timeout'
      };

      const result = await script.halt(params, mockContext);

      expect(result.groupId).toBe('g_1234567890');
      expect(result.userId).toBe('u_1234567890');
      expect(result.authMethodId).toBe('ampw_1234567890');
      expect(result.reason).toBe('timeout');
      expect(result.haltedAt).toBeDefined();
      expect(result.cleanupCompleted).toBe(true);
    });

    test('should handle halt with missing params', async () => {
      const params = {
        reason: 'system_shutdown'
      };

      const result = await script.halt(params, mockContext);

      expect(result.groupId).toBe('unknown');
      expect(result.userId).toBe('unknown');
      expect(result.authMethodId).toBe('unknown');
      expect(result.reason).toBe('system_shutdown');
      expect(result.cleanupCompleted).toBe(true);
    });
  });
});