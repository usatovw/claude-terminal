module.exports = {
  apps: [
    {
      name: "claude-terminal",
      script: "server.js",
      cwd: "/root/projects/Claude/First",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      autorestart: true,
      max_restarts: 10,
      max_memory_restart: "1G",
      error_file: "/root/projects/Claude/First/logs/error.log",
      out_file: "/root/projects/Claude/First/logs/out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      watch: false,
      kill_timeout: 5000,
      listen_timeout: 10000,
    },
  ],
};
