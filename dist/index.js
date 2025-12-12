// SGNL Job Script - Auto-generated bundle
'use strict';

/**
 * SGNL Actions - Authentication Utilities
 *
 * Shared authentication utilities for SGNL actions.
 * Supports: Bearer Token, Basic Auth, OAuth2 Client Credentials, OAuth2 Authorization Code
 */


/**
 * Get the base URL/address for API calls
 * @param {Object} params - Request parameters
 * @param {string} [params.address] - Address from params
 * @param {Object} context - Execution context
 * @returns {string} Base URL
 */
function getBaseURL(params, context) {
  const env = context.environment || {};
  const address = params?.address || env.ADDRESS;

  if (!address) {
    throw new Error('No URL specified. Provide address parameter or ADDRESS environment variable');
  }

  // Remove trailing slash if present
  return address.endsWith('/') ? address.slice(0, -1) : address;
}

/**
 * SGNL Actions - Template Utilities
 *
 * Provides JSONPath-based template resolution for SGNL actions.
 */

/**
 * Simple path getter that traverses an object using dot/bracket notation.
 * Does not use eval or Function constructor, safe for sandbox execution.
 *
 * Supports: dot notation (a.b.c), bracket notation with numbers (items[0]) or
 * strings (items['key'] or items["key"]), nested paths (items[0].name)
 *
 * @param {Object} obj - The object to traverse
 * @param {string} path - The path string (e.g., "user.name" or "items[0].id")
 * @returns {any} The value at the path, or undefined if not found
 */
function get(obj, path) {
  if (!path || obj == null) {
    return undefined;
  }

  // Split path into segments, handling both dot and bracket notation
  // "items[0].name" -> ["items", "0", "name"]
  // "x['store']['book']" -> ["x", "store", "book"]
  const segments = path
    .replace(/\[(\d+)\]/g, '.$1')           // Convert [0] to .0
    .replace(/\['([^']+)'\]/g, '.$1')       // Convert ['key'] to .key
    .replace(/\["([^"]+)"\]/g, '.$1')       // Convert ["key"] to .key
    .split('.')
    .filter(Boolean);

  let current = obj;
  for (const segment of segments) {
    if (current == null) {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}

/**
 * Regex pattern to match JSONPath templates: {$.path.to.value}
 * Matches patterns starting with {$ and ending with }
 */
const TEMPLATE_PATTERN = /\{(\$[^}]+)\}/g;

/**
 * Regex pattern to match an exact JSONPath template (entire string is a single template)
 */
const EXACT_TEMPLATE_PATTERN = /^\{(\$[^}]+)\}$/;

/**
 * Placeholder for values that cannot be resolved
 */
const NO_VALUE_PLACEHOLDER = '{No Value}';

/**
 * Formats a date to RFC3339 format (without milliseconds) to match Go's time.RFC3339.
 * @param {Date} date - The date to format
 * @returns {string} RFC3339 formatted string (e.g., "2025-12-04T17:30:00Z")
 */
function formatRFC3339(date) {
  // toISOString() returns "2025-12-04T17:30:00.123Z", we need "2025-12-04T17:30:00Z"
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Injects SGNL namespace values into the job context.
 * These are runtime values that should be fresh on each execution.
 *
 * @param {Object} jobContext - The job context object
 * @returns {Object} Job context with sgnl namespace injected
 */
function injectSGNLNamespace(jobContext) {
  const now = new Date();

  return {
    ...jobContext,
    sgnl: {
      ...jobContext?.sgnl,
      time: {
        now: formatRFC3339(now),
        ...jobContext?.sgnl?.time
      },
      random: {
        uuid: crypto.randomUUID(),
        ...jobContext?.sgnl?.random
      }
    }
  };
}

/**
 * Extracts a value from JSON using path traversal.
 *
 * Supported: dot notation (a.b.c), bracket notation (items[0]),
 * nested paths (items[0].name), deep nesting (a.b.c.d.e).
 *
 * TODO: Advanced JSONPath features not supported: wildcard [*], filters [?()],
 * recursive descent (..), slices [start:end], scripts [()].
 *
 * @param {Object} json - The JSON object to extract from
 * @param {string} jsonPath - The JSONPath expression (e.g., "$.user.email")
 * @returns {{ value: any, found: boolean }} The extracted value and whether it was found
 */
function extractJSONPathValue(json, jsonPath) {
  try {
    // Convert JSONPath to path by removing leading $. or $
    let path = jsonPath;
    if (path.startsWith('$.')) {
      path = path.slice(2);
    } else if (path.startsWith('$')) {
      path = path.slice(1);
    }

    // Handle root reference ($)
    if (!path) {
      return { value: json, found: true };
    }

    const results = get(json, path);

    // Check if value was found
    if (results === undefined || results === null) {
      return { value: null, found: false };
    }

    return { value: results, found: true };
  } catch {
    return { value: null, found: false };
  }
}

/**
 * Converts a value to string representation.
 *
 * @param {any} value - The value to convert
 * @returns {string} String representation of the value
 */
function valueToString(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value);
}

/**
 * Resolves a single template string by replacing all {$.path} patterns with values.
 *
 * @param {string} templateString - The string containing templates
 * @param {Object} jobContext - The job context to resolve templates from
 * @param {Object} [options] - Resolution options
 * @param {boolean} [options.omitNoValueForExactTemplates=false] - If true, exact templates that can't be resolved return empty string
 * @returns {{ result: string, errors: string[] }} The resolved string and any errors
 */
function resolveTemplateString(templateString, jobContext, options = {}) {
  const { omitNoValueForExactTemplates = false } = options;
  const errors = [];

  // Check if the entire string is a single exact template
  const isExactTemplate = EXACT_TEMPLATE_PATTERN.test(templateString);

  const result = templateString.replace(TEMPLATE_PATTERN, (_, jsonPath) => {
    const { value, found } = extractJSONPathValue(jobContext, jsonPath);

    if (!found) {
      errors.push(`failed to extract field '${jsonPath}': field not found`);

      // For exact templates with omitNoValue, return empty string
      if (isExactTemplate && omitNoValueForExactTemplates) {
        return '';
      }

      return NO_VALUE_PLACEHOLDER;
    }

    const strValue = valueToString(value);

    if (strValue === '') {
      errors.push(`failed to extract field '${jsonPath}': field is empty`);
      return '';
    }

    return strValue;
  });

  return { result, errors };
}

/**
 * Resolves JSONPath templates in the input object/string using job context.
 *
 * Template syntax: {$.path.to.value}
 * - {$.user.email} - Extracts user.email from jobContext
 * - {$.sgnl.time.now} - Current RFC3339 timestamp (injected at runtime)
 * - {$.sgnl.random.uuid} - Random UUID (injected at runtime)
 *
 * @param {Object|string} input - The input containing templates to resolve
 * @param {Object} jobContext - The job context (from context.data) to resolve templates from
 * @param {Object} [options] - Resolution options
 * @param {boolean} [options.omitNoValueForExactTemplates=false] - If true, removes keys where exact templates can't be resolved
 * @param {boolean} [options.injectSGNLNamespace=true] - If true, injects sgnl.time.now and sgnl.random.uuid
 * @returns {{ result: Object|string, errors: string[] }} The resolved input and any errors encountered
 *
 * @example
 * // Basic usage
 * const jobContext = { user: { email: 'john@example.com' } };
 * const input = { login: '{$.user.email}' };
 * const { result } = resolveJSONPathTemplates(input, jobContext);
 * // result = { login: 'john@example.com' }
 *
 * @example
 * // With runtime values
 * const { result } = resolveJSONPathTemplates(
 *   { timestamp: '{$.sgnl.time.now}', requestId: '{$.sgnl.random.uuid}' },
 *   {}
 * );
 * // result = { timestamp: '2025-12-04T10:30:00Z', requestId: '550e8400-...' }
 */
function resolveJSONPathTemplates(input, jobContext, options = {}) {
  const {
    omitNoValueForExactTemplates = false,
    injectSGNLNamespace: shouldInjectSgnl = true
  } = options;

  // Inject SGNL namespace if enabled
  const resolvedJobContext = shouldInjectSgnl ? injectSGNLNamespace(jobContext || {}) : (jobContext || {});

  const allErrors = [];

  /**
   * Recursively resolve templates in a value
   */
  function resolveValue(value) {
    if (typeof value === 'string') {
      const { result, errors } = resolveTemplateString(value, resolvedJobContext, { omitNoValueForExactTemplates });
      allErrors.push(...errors);
      return result;
    }

    if (Array.isArray(value)) {
      const resolved = value.map(item => resolveValue(item));
      if (omitNoValueForExactTemplates) {
        return resolved.filter(item => item !== '');
      }
      return resolved;
    }

    if (value !== null && typeof value === 'object') {
      const resolved = {};
      for (const [key, val] of Object.entries(value)) {
        const resolvedVal = resolveValue(val);

        // If omitNoValueForExactTemplates is enabled, skip keys with empty exact template values
        if (omitNoValueForExactTemplates && resolvedVal === '') {
          continue;
        }

        resolved[key] = resolvedVal;
      }
      return resolved;
    }

    // Return non-string primitives as-is
    return value;
  }

  const result = resolveValue(input);

  return { result, errors: allErrors };
}

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
      'Content-Type': 'application/json'
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
      'Content-Type': 'application/json'
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
      'Content-Type': 'application/json'
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

var script = {
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
    const jobContext = context.data || {};

    // Resolve JSONPath templates in params
    const { result: resolvedParams, errors } = resolveJSONPathTemplates(params, jobContext);
    if (errors.length > 0) {
     console.warn('Template resolution errors:', errors);
    }

    try {
      validateInputs(resolvedParams);

      const { groupId, userId, authMethodId } = resolvedParams;

      console.log(`Processing group ID: ${groupId}, user ID: ${userId}`);

      if (!context.secrets?.BASIC_USERNAME || !context.secrets?.BASIC_PASSWORD) {
        throw new FatalError('Missing required secrets: BASIC_USERNAME and BASIC_PASSWORD');
      }

      // Get base URL using utility function
      const baseUrl = getBaseURL(resolvedParams, context);

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

module.exports = script;
