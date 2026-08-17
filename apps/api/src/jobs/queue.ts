import { randomUUID } from "crypto"
import { redis } from "../config/redis.js"
import { logger } from "../utils/logger.js"

export interface JobRecord<T> {
  id: string
  name: string
  data: T
  attempts: number
  maxAttempts: number
  backoffMs: number
}

export interface AddJobOptions {
  /** Deterministic id — a duplicate add is a no-op (SET NX keeps the first). */
  jobId?: string
  delayMs?: number
  attempts?: number
  backoffMs?: number
}

export type JobHandler<T> = (jobName: string, data: T) => Promise<void>

const JOB_TTL_SECONDS = 60 * 60 * 24

const jobKey = (queue: string, id: string) => `job:${queue}:${id}`
const pendingKey = (queue: string) => `queue:${queue}:pending`
const lockKey = (queue: string, id: string) => `queue:${queue}:lock:${id}`

/**
 * Minimal durable queue over Upstash Redis (REST). Replaces BullMQ: Upstash's
 * HTTP API has no blocking commands, so the worker polls due jobs (ZRANGE
 * BYSCORE) instead of BRPOPLPUSH. Deterministic jobIds dedupe via SET NX and
 * a short lock (SET NX EX) stops two API instances from double-processing.
 *
 * Delivery: payloads live in `job:{queue}:{id}` (24h TTL), schedule in the
 * `queue:{queue}:pending` sorted set scored by run-at ms. A failed run is
 * re-scheduled with exponential backoff until maxAttempts, then dropped
 * (logged) — same shape as the old BullMQ options.
 *
 * ponytail: no stalled-job recovery — if a worker crashes mid-run the job
 * stays pending and re-runs once its lock expires (handlers must be
 * idempotent), but a crash after the handler succeeded but before the
 * cleanup re-runs it too. Upgrade to QStash if delivery semantics matter.
 */
export class JobQueue<T> {
  private polling = false

  constructor(
    private readonly queueName: string,
    private readonly opts: { pollMs?: number; batchSize?: number } = {},
  ) {}

  async add(name: string, data: T, opts: AddJobOptions = {}): Promise<void> {
    const id = opts.jobId ?? randomUUID()
    const record: JobRecord<T> = {
      id,
      name,
      data,
      attempts: 0,
      maxAttempts: opts.attempts ?? 3,
      backoffMs: opts.backoffMs ?? 5000,
    }
    const created = await redis.set(jobKey(this.queueName, id), JSON.stringify(record), {
      nx: true,
      ex: JOB_TTL_SECONDS,
    })
    if (!created) return
    await redis.zadd(pendingKey(this.queueName), {
      score: Date.now() + (opts.delayMs ?? 0),
      member: id,
    })
  }

  /** Poll the pending set and run due jobs. Idempotent — safe to call once. */
  start(handler: JobHandler<T>): void {
    const poll = async (): Promise<void> => {
      if (this.polling) return
      this.polling = true
      try {
        await this.pollOnce(handler)
      } catch (err) {
        logger.error(
          { queue: this.queueName, err: (err as Error).message },
          "job_poll_failed",
        )
      } finally {
        this.polling = false
      }
    }
    void poll()
    setInterval(() => void poll(), this.opts.pollMs ?? 1000)
  }

  private async pollOnce(handler: JobHandler<T>): Promise<void> {
    const due = await redis.zrange<string[]>(pendingKey(this.queueName), "-inf", Date.now(), {
      byScore: true,
      offset: 0,
      count: this.opts.batchSize ?? 10,
    })

    await Promise.allSettled(
      due.map((id) => this.runJob(id, handler)),
    )
  }

  private async runJob(id: string, handler: JobHandler<T>): Promise<void> {
    const lock = await redis.set(lockKey(this.queueName, id), "1", {
      nx: true,
      ex: 60,
    })
    if (!lock) return

    try {
      const raw = await redis.get<string>(jobKey(this.queueName, id))
      if (!raw) {
        await redis.zrem(pendingKey(this.queueName), id)
        return
      }
      const record = JSON.parse(raw) as JobRecord<T>

      try {
        await handler(record.name, record.data)
        await redis.del(jobKey(this.queueName, id))
        await redis.zrem(pendingKey(this.queueName), id)
      } catch (err) {
        record.attempts += 1
        if (record.attempts >= record.maxAttempts) {
          logger.error(
            {
              queue: this.queueName,
              jobId: id,
              name: record.name,
              err: (err as Error).message,
            },
            "job_failed_permanently",
          )
          await redis.del(jobKey(this.queueName, id))
          await redis.zrem(pendingKey(this.queueName), id)
        } else {
          const backoff = record.backoffMs * 2 ** (record.attempts - 1)
          await redis.set(jobKey(this.queueName, id), JSON.stringify(record), {
            ex: JOB_TTL_SECONDS,
          })
          await redis.zadd(pendingKey(this.queueName), {
            score: Date.now() + backoff,
            member: id,
          })
        }
      }
    } finally {
      await redis.del(lockKey(this.queueName, id))
    }
  }
}