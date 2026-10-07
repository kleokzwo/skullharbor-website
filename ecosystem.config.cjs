module.exports = {
  apps: [{
    name: 'skullharbor-api',
    script: 'server/index.js',
    cwd: '/var/www/skullharbor.org',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    env: { NODE_ENV: 'production', HOST: '127.0.0.1', PORT: '8787' }
  }]
};
