import { getBaseURL, SGNL_USER_AGENT} from '@sgnl-actions/utils';

class RetryableError extends Error {
  constructor(message) {
    super(message);
    this.retryable = true;
  }
}

class FatalError extends Error {
  constructor(message) {
    super(message);
    this.retryable = false;
  }
}

function validateInputs(params) {
  if (!params.groupId || typeof params.groupId !== 'string' || params.groupId.trim() === '') {
    throw new FatalError('Invalid or missing groupId parameter');
  }

  if (!params.userId || typeof params.userId !== 'string' || params.userId.trim() === '') {
    throw new FatalError('Invalid or missing userId parameter');
  }

  if (!params.authMethodId || typeof params.authMethodId !== 'string' || params.authMethodId.trim() === '') {
    throw new FatalError('Invalid or missing authMethodId parameter');
  }
}

async function authenticate(authMethodId, username, password, baseUrl) {
  const url = `${baseUrl}/v1/auth-methods/${encodeURIComponent(authMethodId)}:authenticate`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': SGNL_USER_AGENT
    },
    body: JSON.stringify({
      attributes: {
        login_name: username,
        password: password
      }
    })
  });

  if (!response.ok) {
    const responseText = await response.text();

    if (response.status === 429) {
      throw new RetryableError('Boundary API rate limit exceeded');
    }

    if (response.status === 401 || response.status === 403) {
      throw new FatalError('Invalid username or password');
    }

    if (response.status >= 500) {
      throw new RetryableError(`Boundary API server error: ${response.status}`);
    }

    throw new FatalError(`Failed to authenticate: ${response.status} ${response.statusText} - ${responseText}`);
  }

  const data = await response.json();

  if (!data.attributes?.token) {
    throw new FatalError('No token returned from authentication');
  }

  return data.attributes.token;
}

async function getGroup(groupId, token, baseUrl) {
  const url = `${baseUrl}/v1/groups/${encodeURIComponent(groupId)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': SGNL_USER_AGENT
    }
  });

  if (!response.ok) {
    const responseText = await response.text();

    if (response.status === 429) {
      throw new RetryableError('Boundary API rate limit exceeded');
    }

    if (response.status === 401) {
      throw new FatalError('Invalid or expired authentication token');
    }

    if (response.status === 404) {
      throw new FatalError(`Group not found: ${groupId}`);
    }

    if (response.status >= 500) {
      throw new RetryableError(`Boundary API server error: ${response.status}`);
    }

    throw new FatalError(`Failed to get group: ${response.status} ${response.statusText} - ${responseText}`);
  }

  const data = await response.json();

  if (!data.version) {
    throw new FatalError('No version returned from group');
  }

  return data.version;
}

async function addUserToGroup(groupId, userId, version, token, baseUrl) {
  const url = `${baseUrl}/v1/groups/${encodeURIComponent(groupId)}:add-members`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': SGNL_USER_AGENT
    },
    body: JSON.stringify({
      version: version,
      member_ids: [userId]
    })
  });

  if (!response.ok) {
    const responseText = await response.text();

    if (response.status === 429) {
      throw new RetryableError('Boundary API rate limit exceeded');
    }

    if (response.status === 401) {
      throw new FatalError('Invalid or expired authentication token');
    }

    if (response.status === 404) {
      throw new FatalError(`Group or user not found: ${groupId} / ${userId}`);
    }

    if (response.status === 409) {
      // Conflict - user may already be in group or version mismatch
      throw new FatalError(`Conflict (user may already be in group): ${responseText}`);
    }

    if (response.status >= 500) {
      throw new RetryableError(`Boundary API server error: ${response.status}`);
    }

    throw new FatalError(`Failed to add user to group: ${response.status} ${response.statusText} - ${responseText}`);
  }

  return true;
}

export default {
  /**
   * Main execution handler - adds a user to a HashiCorp Boundary group
   * @param {Object} params - Job input parameters
   * @param {string} params.groupId - The Boundary group ID to add the user to
   * @param {string} params.userId - The Boundary user ID to add
   * @param {string} params.authMethodId - The Boundary auth method ID for authentication
   *
   * @param {Object} context - Execution context with secrets and environment
   * @param {string} context.secrets.BASIC_USERNAME - Username for HashiCorp Boundary authentication
   * @param {string} context.secrets.BASIC_PASSWORD - Password for HashiCorp Boundary authentication
   * @param {string} context.environment.ADDRESS - Default HashiCorp Boundary API base URL
   *
   * @returns {Object} Job results
   */
  invoke: async (params, context) => {
    console.log('Starting HashiCorp Boundary Add User to Group action');

    try {
      validateInputs(params);

      const { groupId, userId, authMethodId } = params;

      console.log(`Processing group ID: ${groupId}, user ID: ${userId}`);

      if (!context.secrets?.BASIC_USERNAME || !context.secrets?.BASIC_PASSWORD) {
        throw new FatalError('Missing required secrets: BASIC_USERNAME and BASIC_PASSWORD');
      }

      // Get base URL using utility function
      const baseUrl = getBaseURL(params, context);

      // Step 1: Authenticate to get a token
      console.log(`Authenticating with auth method: ${authMethodId}`);
      const token = await authenticate(
        authMethodId,
        context.secrets.BASIC_USERNAME,
        context.secrets.BASIC_PASSWORD,
        baseUrl
      );

      // Add small delay between operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Step 2: Get group details to retrieve version
      console.log(`Getting group details for: ${groupId}`);
      const version = await getGroup(groupId, token, baseUrl);

      // Add small delay between operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Step 3: Add user to group
      console.log(`Adding user ${userId} to group ${groupId} with version: ${version}`);
      await addUserToGroup(groupId, userId, version, token, baseUrl);

      const result = {
        groupId,
        userId,
        authMethodId,
        userAdded: true,
        addedAt: new Date().toISOString()
      };

      console.log(`Successfully added user ${userId} to group ${groupId}`);
      return result;

    } catch (error) {
      console.error(`Error adding user to Boundary group: ${error.message}`);

      if (error instanceof RetryableError || error instanceof FatalError) {
        throw error;
      }

      throw new FatalError(`Unexpected error: ${error.message}`);
    }
  },

  /**
   * Error recovery handler - framework handles retries by default
   *
   * @param {Object} params - Original params plus error information
   * @param {Object} context - Execution context
   *
   * @returns {Object} Recovery results
   */
  error: async (params, _context) => {
    const { error } = params;
    console.error(`Error handler invoked: ${error?.message}`);

    // Re-throw to let framework handle retries
    throw error;
  },

  /**
   * Graceful shutdown handler - cleanup when job is halted
   *
   * @param {Object} params - Original params plus halt reason
   * @param {Object} context - Execution context
   *
   * @returns {Object} Cleanup results
   */
  halt: async (params, _context) => {
    const { reason, groupId, userId, authMethodId } = params;
    console.log(`Job is being halted (${reason})`);

    return {
      groupId: groupId || 'unknown',
      userId: userId || 'unknown',
      authMethodId: authMethodId || 'unknown',
      reason: reason || 'unknown',
      haltedAt: new Date().toISOString(),
      cleanupCompleted: true
    };
  }
};