import pino from "pino"
import { config } from "../config/index.js"

/**
 * Shared pino logger instance.
 *
 * - In **development**: uses pino-pretty with colorized output and `debug` level
 * - In **production**: outputs standard JSON lines at `info` level
 *
 * Every log line automatically includes `service: "skillshill-api"` for
 * easy filtering in log aggregation tools (Datadog, Grafana Loki, etc.).
 */
export const logger = pino({
  level: config.NODE_ENV === "production" ? "info" : "debug",
  ...(config.NODE_ENV !== "production" && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss.l",
        ignore: "pid,hostname,service",
      },
    },
  }),
  base: {
    service: "skillshill-api",
    env: config.NODE_ENV,
  },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.body.password",
      "req.body.currentPassword",
      "req.body.turnstileToken",
      "body.password",
      "body.currentPassword",
      "body.turnstileToken",
    ],
    censor: "[REDACTED]",
  },
})
