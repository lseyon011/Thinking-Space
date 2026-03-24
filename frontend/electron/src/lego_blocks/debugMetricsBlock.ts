import { execFile } from 'child_process';
import { app } from 'electron';
import * as os from 'os';

export interface DebugProcessMetricBlock {
  pid: number;
  type: string;
  name: string | null;
  serviceName: string | null;
  cpuPercent: number;
  idleWakeupsPerSecond: number;
  workingSetBytes: number;
  peakWorkingSetBytes: number;
  threads: number | null;
}

export interface DebugPerformanceSnapshotBlock {
  appCpuPercent: number;
  appMemoryWorkingSetBytes: number;
  appMemoryPeakWorkingSetBytes: number;
  processCount: number;
  threadCount: number | null;
  browserProcessCount: number;
  rendererProcessCount: number;
  utilityProcessCount: number;
  gpuProcessCount: number;
  logicalCpuCount: number;
  gpuProcessCpuPercent: number | null;
  gpuProcessMemoryWorkingSetBytes: number | null;
  gpuRenderer: string | null;
  gpuModel: string | null;
  gpuFeatureStatus: Record<string, string>;
  topProcesses: DebugProcessMetricBlock[];
}

type ThreadCountMapBlock = Record<number, number>;

let gpuDetailsPromiseBlock: Promise<{ gpuRenderer: string | null; gpuModel: string | null }> | null = null;

function readStringBlock(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readRecordBlock(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function kilobytesToBytesBlock(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value * 1024 : 0;
}

function roundMetricBlock(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value * 10) / 10
    : 0;
}

function readGpuFeatureStatusBlock(): Record<string, string> {
  const raw = app.getGPUFeatureStatus() as unknown as Record<string, unknown>;
  const entries = Object.entries(raw)
    .filter(([, value]) => typeof value === 'string')
    .map(([key, value]) => [key, String(value)]);
  return Object.fromEntries(entries);
}

async function readGpuDetailsBlock(): Promise<{ gpuRenderer: string | null; gpuModel: string | null }> {
  if (!gpuDetailsPromiseBlock) {
    gpuDetailsPromiseBlock = app.getGPUInfo('basic')
      .then((raw) => {
        const info = readRecordBlock(raw);
        const aux = readRecordBlock(info?.auxAttributes);
        const gpuDevices = Array.isArray(info?.gpuDevice) ? info?.gpuDevice : [];
        const primaryGpu = gpuDevices
          .map(device => readRecordBlock(device))
          .find(device => device && device.active !== false)
          ?? gpuDevices.map(device => readRecordBlock(device)).find(Boolean)
          ?? null;

        return {
          gpuRenderer:
            readStringBlock(aux?.glRenderer)
            ?? readStringBlock(aux?.gl_renderer)
            ?? readStringBlock(aux?.glVendor)
            ?? null,
          gpuModel:
            readStringBlock(primaryGpu?.deviceString)
            ?? readStringBlock(primaryGpu?.vendorString)
            ?? readStringBlock(info?.modelName)
            ?? null,
        };
      })
      .catch(() => ({ gpuRenderer: null, gpuModel: null }));
  }
  return gpuDetailsPromiseBlock;
}

function readThreadCountsForDarwinBlock(pids: number[]): Promise<ThreadCountMapBlock> {
  if (pids.length === 0) return Promise.resolve({});

  return new Promise((resolve) => {
    execFile('ps', ['-M', '-o', 'pid=', '-p', pids.join(',')], { timeout: 2_000 }, (error, stdout) => {
      if (error) {
        resolve({});
        return;
      }

      const counts: ThreadCountMapBlock = {};
      for (const line of stdout.split('\n')) {
        const pid = Number.parseInt(line.trim(), 10);
        if (!Number.isFinite(pid)) continue;
        counts[pid] = (counts[pid] ?? 0) + 1;
      }
      resolve(counts);
    });
  });
}

function readThreadCountsForLinuxBlock(pids: number[]): Promise<ThreadCountMapBlock> {
  if (pids.length === 0) return Promise.resolve({});

  return new Promise((resolve) => {
    execFile('ps', ['-o', 'pid=,nlwp=', '-p', pids.join(',')], { timeout: 2_000 }, (error, stdout) => {
      if (error) {
        resolve({});
        return;
      }

      const counts: ThreadCountMapBlock = {};
      for (const line of stdout.split('\n')) {
        const [pidRaw, threadRaw] = line.trim().split(/\s+/);
        const pid = Number.parseInt(pidRaw ?? '', 10);
        const threads = Number.parseInt(threadRaw ?? '', 10);
        if (!Number.isFinite(pid) || !Number.isFinite(threads)) continue;
        counts[pid] = threads;
      }
      resolve(counts);
    });
  });
}

async function readThreadCountsBlock(pids: number[]): Promise<ThreadCountMapBlock> {
  if (process.platform === 'darwin') return readThreadCountsForDarwinBlock(pids);
  if (process.platform === 'linux') return readThreadCountsForLinuxBlock(pids);
  return {};
}

export async function readDebugPerformanceSnapshotBlock(): Promise<DebugPerformanceSnapshotBlock> {
  const metrics = app.getAppMetrics();
  const pidList = metrics.map(metric => metric.pid).filter(pid => Number.isFinite(pid));
  const [gpuDetails, threadCounts] = await Promise.all([
    readGpuDetailsBlock(),
    readThreadCountsBlock(pidList),
  ]);

  const processes: DebugProcessMetricBlock[] = metrics.map((metric) => ({
    pid: metric.pid,
    type: metric.type,
    name: readStringBlock(metric.name),
    serviceName: readStringBlock(metric.serviceName),
    cpuPercent: roundMetricBlock(metric.cpu.percentCPUUsage),
    idleWakeupsPerSecond: roundMetricBlock(metric.cpu.idleWakeupsPerSecond),
    workingSetBytes: kilobytesToBytesBlock(metric.memory.workingSetSize),
    peakWorkingSetBytes: kilobytesToBytesBlock(metric.memory.peakWorkingSetSize),
    threads: threadCounts[metric.pid] ?? null,
  }));

  const gpuProcesses = processes.filter(processMetric => processMetric.type === 'GPU');
  const browserProcessCount = processes.filter(processMetric => processMetric.type === 'Browser').length;
  const rendererProcessCount = processes.filter(processMetric => processMetric.type === 'Tab').length;
  const utilityProcessCount = processes.filter(processMetric => processMetric.type === 'Utility').length;

  return {
    appCpuPercent: roundMetricBlock(processes.reduce((sum, processMetric) => sum + processMetric.cpuPercent, 0)),
    appMemoryWorkingSetBytes: processes.reduce((sum, processMetric) => sum + processMetric.workingSetBytes, 0),
    appMemoryPeakWorkingSetBytes: processes.reduce((sum, processMetric) => sum + processMetric.peakWorkingSetBytes, 0),
    processCount: processes.length,
    threadCount:
      Object.keys(threadCounts).length > 0
        ? processes.reduce((sum, processMetric) => sum + (processMetric.threads ?? 0), 0)
        : null,
    browserProcessCount,
    rendererProcessCount,
    utilityProcessCount,
    gpuProcessCount: gpuProcesses.length,
    logicalCpuCount: os.cpus().length,
    gpuProcessCpuPercent:
      gpuProcesses.length > 0
        ? roundMetricBlock(gpuProcesses.reduce((sum, processMetric) => sum + processMetric.cpuPercent, 0))
        : null,
    gpuProcessMemoryWorkingSetBytes:
      gpuProcesses.length > 0
        ? gpuProcesses.reduce((sum, processMetric) => sum + processMetric.workingSetBytes, 0)
        : null,
    gpuRenderer: gpuDetails.gpuRenderer,
    gpuModel: gpuDetails.gpuModel,
    gpuFeatureStatus: readGpuFeatureStatusBlock(),
    topProcesses: [...processes]
      .sort((left, right) => {
        if (right.cpuPercent !== left.cpuPercent) return right.cpuPercent - left.cpuPercent;
        return right.workingSetBytes - left.workingSetBytes;
      })
      .slice(0, 5),
  };
}
