import mongoose from "mongoose"
import { config } from "./index.js"
import { logger } from "../utils/logger.js"

let connected = false

export async function connectMongo(): Promise<void> {
  if (connected) return

  mongoose.set("strictQuery", true)
  await mongoose.connect(config.MONGODB_URI)

  connected = true
  logger.info({ uri: config.MONGODB_URI }, "mongodb_connected")
}

export async function disconnectMongo(): Promise<void> {
  if (!connected) return
  await mongoose.disconnect()
  connected = false
  logger.info({}, "mongodb_disconnected")
}
