import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  runInContainer,
  runCodeInDocker,
  isDockerAvailable,
  __resetDockerClient,
} from "./sandbox.js"

const mocks = vi.hoisted(() => ({
  createContainer: vi.fn(),
  attach: vi.fn(),
  start: vi.fn(),
  wait: vi.fn(),
  stats: vi.fn(),
  kill: vi.fn(),
  remove: vi.fn(),
  ping: vi.fn(),
  demuxStream: vi.fn(),
  write: vi.fn(),
  end: vi.fn(),
}))

vi.mock("dockerode", () => ({
  default: class {
    ping = mocks.ping
    // Propagate the mock's resolve/reject — never swallow failures.
    async createContainer(opts: unknown) {
      return mocks.createContainer(opts)
    }
  },
}))

vi.mock("../../utils/logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}))

const BASE_OPTIONS = {
  image: "node:20-alpine",
  command: ["node", "main.js"],
  workdir: "/tmp/judge-test",
  timeLimitMs: 5000,
  memoryMb: 256,
}

function fakeStream() {
  // `.on` is needed because the sandbox attaches an error listener to the
  // attach stream (unhandled socket errors would crash the worker).
  return { write: mocks.write, end: mocks.end, on: vi.fn() }
}

/** Default demux behavior: stdout emits a line, stderr emits a warning. */
function mockDemuxDefault(): void {
  mocks.demuxStream.mockImplementation((_stream, stdoutW, stderrW) => {
    stdoutW.emit("data", Buffer.from("42\n"))
    stderrW.emit("data", Buffer.from("some warning"))
  })
}

function makeContainer() {
  return {
    modem: { demuxStream: mocks.demuxStream },
    attach: mocks.attach,
    start: mocks.start,
    wait: mocks.wait,
    stats: mocks.stats,
    kill: mocks.kill,
    remove: mocks.remove,
  }
}

function mockContainerCreate(): void {
  mocks.createContainer.mockImplementation(async () => makeContainer())
}

describe("runInContainer", () => {
  beforeEach(() => {
    __resetDockerClient()
    vi.clearAllMocks()
    mockContainerCreate()
    mocks.attach.mockResolvedValue(fakeStream())
    mocks.start.mockResolvedValue(undefined)
    mocks.wait.mockResolvedValue({ StatusCode: 0 })
    mocks.stats.mockResolvedValue({ memory_stats: { usage: 1024 * 1024 } })
    mocks.kill.mockResolvedValue(undefined)
    mocks.remove.mockResolvedValue(undefined)
    mocks.ping.mockResolvedValue(undefined)
    mockDemuxDefault()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("creates a locked-down container and returns captured output + memory", async () => {
    const result = await runInContainer({
      ...BASE_OPTIONS,
      input: "5",
    })

    expect(result.exitCode).toBe(0)
    expect(result.timedOut).toBe(false)
    expect(result.infraError).toBe(false)
    expect(result.stdout).toBe("42\n")
    expect(result.stderr).toBe("some warning")
    expect(result.memoryBytes).toBe(1024 * 1024)
    expect(result.durationMs).toBeGreaterThanOrEqual(0)

    // Container is configured with the full sandbox lockdown.
    const opts = mocks.createContainer.mock.calls[0][0]
    expect(opts.Image).toBe("node:20-alpine")
    expect(opts.Cmd).toEqual(["node", "main.js"])
    expect(opts.WorkingDir).toBe("/workspace")
    // Non-root user is part of the container config, not HostConfig.
    expect(opts.User).toBe("1000:1000")
    expect(opts.HostConfig).toMatchObject({
      NetworkMode: "none",
      Memory: 256 * 1024 * 1024,
      NanoCpus: 1e9,
      PidsLimit: 50,
      ReadonlyRootfs: true,
      CapDrop: ["ALL"],
    })
    expect(opts.HostConfig.Binds[0]).toContain(BASE_OPTIONS.workdir)
    expect(opts.HostConfig.Tmpfs).toBeDefined()

    // Input is written to the container stdin, cleanup removes the container.
    expect(mocks.write).toHaveBeenCalledWith("5")
    expect(mocks.end).toHaveBeenCalled()
    expect(mocks.remove).toHaveBeenCalledWith({ force: true })
  })

  it("kills the container when the time limit is exceeded", async () => {
    vi.useFakeTimers()

    let resolveWait: (v: { StatusCode: number }) => void
    const waitPromise = new Promise<{ StatusCode: number }>((r) => {
      resolveWait = r
    })
    mocks.wait.mockReturnValue(waitPromise)
    mocks.kill.mockImplementation(async () => {
      resolveWait({ StatusCode: 137 })
    })

    const runPromise = runInContainer({
      ...BASE_OPTIONS,
      timeLimitMs: 1000,
    })

    await vi.advanceTimersByTimeAsync(1001)
    const result = await runPromise

    expect(mocks.kill).toHaveBeenCalled()
    expect(result.timedOut).toBe(true)
    expect(result.exitCode).toBe(137)
    expect(mocks.remove).toHaveBeenCalledWith({ force: true })
  })

  it("throws a typed SANDBOX_FAILED error when createContainer fails", async () => {
    mocks.createContainer.mockRejectedValueOnce(new Error("daemon down"))

    await expect(runInContainer(BASE_OPTIONS)).rejects.toMatchObject({
      status: 500,
      code: "SANDBOX_FAILED",
    })
  })
})

describe("runCodeInDocker", () => {
  beforeEach(() => {
    __resetDockerClient()
    vi.clearAllMocks()
    mockContainerCreate()
    mocks.attach.mockResolvedValue(fakeStream())
    mocks.start.mockResolvedValue(undefined)
    mocks.wait.mockResolvedValue({ StatusCode: 0 })
    mocks.stats.mockResolvedValue({ memory_stats: { usage: 0 } })
    mocks.kill.mockResolvedValue(undefined)
    mocks.remove.mockResolvedValue(undefined)
    mockDemuxDefault()
  })

  it("writes the code file into the mounted workdir and runs", async () => {
    await runCodeInDocker({
      ...BASE_OPTIONS,
      fileBase: "main",
      extension: "js",
      code: "console.log(42)",
    })

    const opts = mocks.createContainer.mock.calls[0][0]
    // The tmpdir existed with the code file at the time of the run — the file
    // is gone after cleanup, so we assert the mount used a real temp dir.
    // (Check the whole bind string — a bare split on ":" breaks on Windows
    // drive-letter paths like C:\Users\...)
    expect(opts.HostConfig.Binds[0]).toContain("judge-")
    expect(mocks.createContainer).toHaveBeenCalledTimes(1)
  })
})

describe("isDockerAvailable", () => {
  beforeEach(() => {
    __resetDockerClient()
    vi.clearAllMocks()
  })

  it("returns true when the daemon pings", async () => {
    mocks.ping.mockResolvedValue(undefined)
    await expect(isDockerAvailable()).resolves.toBe(true)
  })

  it("returns false when the daemon is unreachable", async () => {
    mocks.ping.mockRejectedValueOnce(new Error("Cannot connect"))
    await expect(isDockerAvailable()).resolves.toBe(false)
  })
})
