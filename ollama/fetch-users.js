import KcAdminClient from '@keycloak/keycloak-admin-client';

const keycloakUrl = 'https://app.codecollective.us/keycloak/auth';
const realm = 'master';
const username = 'admin';  // Your admin username
const password = 'changeme';  // Your admin password

const kcAdminClient = new KcAdminClient({
  baseUrl: keycloakUrl,
  realmName: realm,
});

async function authenticate() {
  try {
    await kcAdminClient.auth({
      username: username,
      password: password,
      grantType: 'password',
      clientId: 'admin-cli'
    });
  } catch (error) {
    console.error('Authentication failed:', error);
    throw error;
  }
}

async function fetchUsers() {
  try {
    await authenticate();
    const users = await kcAdminClient.users.find();
    console.log('Users:', users);
  } catch (error) {
    console.error('Failed to fetch users:', error);
  }
}

fetchUsers();