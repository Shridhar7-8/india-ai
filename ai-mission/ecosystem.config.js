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
  }, {
    name: "buildai-sqs-worker",
    script: "npx",
    args: "tsx src/scripts/sqs-worker.ts",
    cwd: "/var/www/buildai/ai-mission",
    env_file: "/var/www/buildai/ai-mission/.env",
    env: {
      NODE_ENV: "production",
    }
  }]
}