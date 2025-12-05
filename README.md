# HashiCorp Boundary Add User to Group Action

Add a user to a group in HashiCorp Boundary for access management and permissions control.

## Overview

This SGNL action integrates with HashiCorp Boundary to add users to groups. When executed, the specified user will be added to the target group, granting them the access permissions associated with that group.

## Prerequisites

- HashiCorp Boundary instance
- Basic authentication credentials (username and password)
- Boundary API access
- Group ID where the user should be added
- User ID to add to the group
- Auth method ID for authentication

## Configuration

### Required Secrets

| Secret | Description |
|--------|-------------|
| `BASIC_USERNAME` | Username for HashiCorp Boundary authentication |
| `BASIC_PASSWORD` | Password for HashiCorp Boundary authentication |

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `ADDRESS` | HashiCorp Boundary API base URL | `https://boundary.example.com` |

### Input Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `groupId` | string | Yes | The Boundary group ID to add user to | `g_1234567890` |
| `userId` | string | Yes | The Boundary user ID to add to group | `u_0987654321` |
| `authMethodId` | string | Yes | The Boundary auth method ID for authentication | `ampw_1234567890` |

### Output Structure

| Field | Type | Description |
|-------|------|-------------|
| `groupId` | string | The group ID that was processed |
| `userId` | string | The user ID that was added |
| `authMethodId` | string | The auth method ID used for authentication |
| `userAdded` | boolean | Whether the user was successfully added to group |
| `addedAt` | datetime | When the operation completed (ISO 8601) |

## Usage Example

### Job Request

```json
{
  "id": "add-user-to-group-001",
  "type": "nodejs-22",
  "script": {
    "repository": "github.com/sgnl-actions/hashicorp-boundary-add-user-to-group",
    "version": "v1.0.0",
    "type": "nodejs"
  },
  "script_inputs": {
    "groupId": "g_1234567890",
    "userId": "u_0987654321",
    "authMethodId": "ampw_1234567890"
  },
  "environment": {
    "ADDRESS": "https://boundary.example.com"
  }
}
```

### Successful Response

```json
{
  "groupId": "g_1234567890",
  "userId": "u_0987654321",
  "authMethodId": "ampw_1234567890",
  "userAdded": true,
  "addedAt": "2024-01-15T10:30:00Z"
}
```

## How It Works

The action performs the following steps:

1. **Authenticate**: Uses the provided auth method ID and credentials to obtain an authentication token from Boundary
2. **Get Group Details**: Retrieves the current group information including its version number (required for updates)
3. **Add User to Group**: Adds the specified user to the group using the version number to ensure consistency

## Error Handling

The action includes comprehensive error handling with retryable and fatal error types:

### Retryable Errors (Framework will retry)
- **429 Rate Limit**: Boundary API rate limit exceeded
- **5xx Server Errors**: Boundary API server errors

### Fatal Errors (Will not retry)
- **401 Unauthorized**: Invalid username or password
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Group or user not found
- **409 Conflict**: User may already be in group or version mismatch
- **Missing Parameters**: Invalid or missing required parameters

## Development

### Local Testing

```bash
# Install dependencies
npm install

# Run tests
npm test

# Test locally with mock data
npm run dev

# Build for production
npm run build
```

### Running Tests

The action includes comprehensive unit tests covering:
- Input validation (groupId, userId, authMethodId)
- Secret validation (BASIC_USERNAME, BASIC_PASSWORD)
- Environment variable validation (ADDRESS)
- Empty parameter validation

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Check test coverage
npm run test:coverage
```

## Security Considerations

- **Credential Protection**: Never log or expose authentication credentials
- **Token Management**: Authentication tokens are ephemeral and obtained per-request
- **Audit Logging**: All operations are logged with timestamps
- **Input Validation**: All parameters are validated before API calls
- **Rate Limiting**: Includes delays between operations to avoid rate limits

## HashiCorp Boundary API Reference

This action uses the following HashiCorp Boundary API endpoints:
- [Authenticate](https://developer.hashicorp.com/boundary/api-docs/authmethods#authenticate)
- [Read Group](https://developer.hashicorp.com/boundary/api-docs/groups#read)
- [Add Members to Group](https://developer.hashicorp.com/boundary/api-docs/groups#add-members)

## Troubleshooting

### Common Issues

1. **"Invalid or missing groupId parameter"**
   - Ensure the `groupId` parameter is provided and is a non-empty string
   - Verify the group ID exists in your Boundary instance

2. **"Invalid or missing userId parameter"**
   - Ensure the `userId` parameter is provided and is a non-empty string
   - Verify the user ID exists in your Boundary instance

3. **"Invalid or missing authMethodId parameter"**
   - Ensure the `authMethodId` parameter is provided and is a non-empty string
   - Verify the auth method ID is correct for your Boundary instance

4. **"Missing required secrets: BASIC_USERNAME and BASIC_PASSWORD"**
   - Ensure both `BASIC_USERNAME` and `BASIC_PASSWORD` secrets are configured
   - Verify the credentials have the correct permissions

5. **"No URL specified. Provide address parameter or ADDRESS environment variable"**
   - Ensure the `ADDRESS` environment variable is set to your Boundary API URL
   - Example: `https://boundary.example.com`

6. **Authentication Errors (401)**
   - Verify your username and password are correct
   - Check that the auth method ID is valid

7. **Group or User Not Found (404)**
   - Verify the group ID and user ID are correct
   - Check that both resources exist in Boundary

8. **Conflict Error (409)**
   - The user may already be a member of the group
   - There may be a version mismatch - the action will handle retries automatically

## License

MIT

## Support

For issues or questions, please contact SGNL Engineering or create an issue in this repository.
