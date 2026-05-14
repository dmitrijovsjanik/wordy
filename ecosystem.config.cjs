module.exports = {
  apps: [
    {
      name: 'wordy',
      cwd: '/var/www/wordy/current/server',
      script: 'dist/index.js',
      node_args: '--env-file=.env',
      env: {
        NODE_ENV: 'production',
        PORT: 3100,
        TZ: 'UTC',
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
      exp_backoff_restart_delay: 1000,
      max_memory_restart: '500M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      out_file: '/var/www/wordy/logs/out.log',
      error_file: '/var/www/wordy/logs/error.log',
      merge_logs: true,
    },
  ],
};
