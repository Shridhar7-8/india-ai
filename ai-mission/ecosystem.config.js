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
<<<<<<< HEAD
    name: "buildai-sqs-worker",
    script: "npx",
    args: "tsx src/scripts/sqs-worker.ts",
=======
    name: "buildai-worker",
    script: "npm",
    args: "run worker",
>>>>>>> bab1d57879f565406e3cec4e5b10a04e1339f383
    cwd: "/var/www/buildai/ai-mission",
    env_file: "/var/www/buildai/ai-mission/.env",
    env: {
      NODE_ENV: "production",
    }
  }]
}