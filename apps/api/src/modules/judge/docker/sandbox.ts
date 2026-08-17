import Docker, { type Container } from "dockerode"
import { PassThrough, type Writable } from "stream"
import { promises as fs } from "fs"
import os from "os"
import path from "path"
import { logger } from "../../../utils/logger.js"

/**
 * Docker sandbox — the isolated code execution environment.
 *
 * Every run gets a fresh container with:
 *   - no network (`NetworkMode: "none"`)       — no data exfiltration
 *   - read-only root fs + dropped capabilities — no fs tampering
 *   - non-root user (UID 1000)                 — no privilege escalation
 *   - memory / CPU / PID limits                — no DoS
 *   - tmpfs /tmp                               — scratch space
 *   - host code mounted read-write at /workspace (ephemeral tmpdir, removed after)
 *
 * All time limits are enforced server-side (kill on timeout) — never trusted
 * to the submitted code.
 */

let docker: Docker | null = null

function getDocker(): Docker {
  if (!docker) {
    // dockerode/docker-modem honors DOCKER_HOST and DOCKER_TLS_VERIFY.
    // On Windows Docker Desktop, set DOCKER_HOST=npipe:////./pipe/docker_engine.
    docker = new Docker()
  }
  return docker
}

export interface RunResult {
  stdout: string
  stderr: string
  exitCode: number
  timedOut: boolean
  /** True when the sandbox itself failed (docker down, image missing) — not the code. */
  infraError: boolean
  durationMs: number
  memoryBytes: number
}

export interface RunOptions {
  image: string
  command: string[]
  workdir: string // host tmpdir mounted at /workspace (code file lives here)
  input?: string
  timeLimitMs: number
  memoryMb: number
}

const MAX_OUTPUT_BYTES = 1024 * 1024 // 1 MB per stream

function collectStream(stream: Writable, sink: { chunks: Buffer[]; size: number }): void {
  stream.on("data", (chunk: Buffer) => {
    if (sink.size >= MAX_OUTPUT_BYTES) return
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    const remaining = MAX_OUTPUT_BYTES - sink.size
    sink.chunks.push(buf.subarray(0, remaining))
    sink.size += Math.min(buf.length, remaining)
  })
}

/**
 * Run a command inside a fresh, locked-down container. Never throws for user
 * code failures — it always resolves with a RunResult. Only genuinely
 * unexpected sandbox failures (docker unreachable, createContainer error)
 * reject, and callers treat those as `infraError`.
 */
export async function runInContainer(options: RunOptions): Promise<RunResult> {
  const startedAt = Date.now()
  let timedOut = false
  let container: Container | null = null
  let timeout: NodeJS.Timeout | null = null

  try {
    const docker = getDocker()
    container = await docker.createContainer({
      Image: options.image,
      Cmd: options.command,
      WorkingDir: "/workspace",
      AttachStdout: true,
      AttachStderr: true,
      OpenStdin: true,
      StdinOnce: true,
      // Non-root user — part of the container config (Docker API), not HostConfig.
      User: "1000:1000",
      HostConfig: {
        NetworkMode: "none",
        Memory: options.memoryMb * 1024 * 1024,
        NanoCpus: 1e9, // 1 CPU
        PidsLimit: 50,
        ReadonlyRootfs: true,
        CapDrop: ["ALL"],
        // Dev note: on Docker Desktop (Windows), host paths in Binds need the
        // /c/... form — set TMPDIR accordingly or the mount will fail.
        Binds: [`${options.workdir}:/workspace`],
        Tmpfs: { "/tmp": "rw,noexec,nosuid,size=64m" },
      },
    })

    // Attach before start so early output isn't missed. The returned stream is
    // multiplexed (stdout/stderr interleaved) — demux it into two collectors.
    const stream = await container.attach({
      stream: true,
      stdin: true,
      stdout: true,
      stderr: true,
    })
    // The attach stream is socket-backed — when we kill a timed-out container
    // the connection resets and can emit 'error' (ECONNRESET). Without a
    // listener that unhandled 'error' would crash the judge worker.
    stream.on("error", () => {})
    const stdoutSink = { chunks: [] as Buffer[], size: 0 }
    const stderrSink = { chunks: [] as Buffer[], size: 0 }
    const stdoutPassthrough = new PassThrough()
    const stderrPassthrough = new PassThrough()
    collectStream(stdoutPassthrough, stdoutSink)
    collectStream(stderrPassthrough, stderrSink)
    container.modem.demuxStream(stream, stdoutPassthrough, stderrPassthrough)

    await container.start()

    timeout = setTimeout(() => {
      timedOut = true
      void container?.kill().catch(() => {})
    }, options.timeLimitMs)

    if (options.input) stream.write(options.input)
    stream.end()

    const waitResult = await container.wait()
    clearTimeout(timeout)
    timeout = null

    const durationMs = Date.now() - startedAt
    const stdout = Buffer.concat(stdoutSink.chunks).toString("utf-8")
    const stderr = Buffer.concat(stderrSink.chunks).toString("utf-8")

    // Peak memory (best effort — stats can be unavailable right after exit).
    let memoryBytes = 0
    try {
      const stats = await container.stats()
      memoryBytes = stats?.memory_stats?.usage ?? 0
    } catch {
      memoryBytes = 0
    }

    return {
      stdout,
      stderr,
      exitCode: waitResult.StatusCode ?? -1,
      timedOut,
      infraError: false,
      durationMs,
      memoryBytes,
    }
  } catch (err) {
    logger.warn(
      { image: options.image, err: (err as Error).message },
      "sandbox_infra_error",
    )
    throw Object.assign(
      new Error(`Sandbox failed: ${(err as Error).message}`),
      { status: 500, code: "SANDBOX_FAILED" },
    )
  } finally {
    if (timeout) clearTimeout(timeout)
    if (container) {
      await container.remove({ force: true }).catch(() => {})
    }
  }
}

/**
 * Write the submitted code to an ephemeral temp dir and run it in the sandbox.
 * The temp dir is created here (not by the caller) and removed afterwards
 * regardless of outcome.
 */
export async function runCodeInDocker(
  options: Omit<RunOptions, "workdir"> & {
    fileBase: string
    extension: string
    code: string
  },
): Promise<RunResult> {
  const workdir = await fs.mkdtemp(path.join(os.tmpdir(), "judge-"))
  try {
    await fs.writeFile(
      path.join(workdir, `${options.fileBase}.${options.extension}`),
      options.code,
      { mode: 0o644 }, // readable by container UID 1000
    )
    return await runInContainer({
      image: options.image,
      command: options.command,
      workdir,
      input: options.input,
      timeLimitMs: options.timeLimitMs,
      memoryMb: options.memoryMb,
    })
  } finally {
    await fs.rm(workdir, { recursive: true, force: true }).catch(() => {})
  }
}

/**
 * Cheap availability probe for the judge worker startup log.
 */
export async function isDockerAvailable(): Promise<boolean> {
  try {
    await getDocker().ping()
    return true
  } catch {
    return false
  }
}

/** Exported for tests / tooling (resets the cached docker client). */
export function __resetDockerClient(): void {
  docker = null
}
