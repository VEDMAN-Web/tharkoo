module.exports = {
  apps: [
    {
      name: "tharkoo",
      script: "server.js",
      node_args: "--max-old-space-size=256",
      max_memory_restart: "340M",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        HOSTNAME: "127.0.0.1",
      },
    },
  ],
};
