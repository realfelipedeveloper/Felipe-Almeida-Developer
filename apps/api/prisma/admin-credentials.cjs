function readDevelopmentAdminConfig(env) {
  const nodeEnv = String(env.NODE_ENV || 'development')
    .trim()
    .toLowerCase();
  if (nodeEnv !== 'development') {
    throw new Error('Este comando só pode ser executado com NODE_ENV=development.');
  }

  const email = String(env.ADMIN_EMAIL || '')
    .trim()
    .toLowerCase();
  const password = String(env.ADMIN_INITIAL_PASSWORD || '');

  if (!email || email.startsWith('todo@') || !email.includes('@')) {
    throw new Error('Defina ADMIN_EMAIL com um endereço válido no arquivo .env.');
  }
  if (!password || password === 'troque-no-primeiro-login') {
    throw new Error('Defina ADMIN_INITIAL_PASSWORD no arquivo .env.');
  }
  if (password.length < 4 || password.length > 200) {
    throw new Error('ADMIN_INITIAL_PASSWORD deve possuir entre 4 e 200 caracteres.');
  }

  return { email, password };
}

module.exports = { readDevelopmentAdminConfig };
