module.exports = {
  apps: [{
    name: "buildai",
    script: "npm",
    args: "start",
    cwd: "/var/www/buildai/ai-mission",
    env_file: "/var/www/buildai/ai-mission/.env",
    env: {
      NODE_ENV: "production",
    }
  }]
}