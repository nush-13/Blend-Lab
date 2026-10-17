import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export class BenchmarkRunStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.runs = null;
    this.writeQueue = Promise.resolve();
  }

  async load() {
    if (this.runs !== null) return;
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8'));
      if (!Array.isArray(parsed)) throw new Error('Benchmark run store must contain an array.');
      this.runs = parsed;
    } catch (error) {
      if (error.code === 'ENOENT') this.runs = [];
      else throw error;
    }
  }

  async get(runId) {
    await this.load();
    await this.writeQueue;
    const run = this.runs.find(item => item.runId === runId);
    return run ? structuredClone(run) : null;
  }

  async list() {
    await this.load();
    await this.writeQueue;
    return structuredClone([...this.runs].sort((left, right) => right.createdAt.localeCompare(left.createdAt)));
  }

  async save(run) {
    await this.load();
    const index = this.runs.findIndex(item => item.runId === run.runId);
    if (index === -1) this.runs.push(structuredClone(run));
    else this.runs[index] = structuredClone(run);

    const write = this.writeQueue.then(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      const tempPath = `${this.filePath}.${randomUUID()}.tmp`;
      try {
        await writeFile(tempPath, JSON.stringify(this.runs), 'utf8');
        await rename(tempPath, this.filePath);
      } finally {
        await rm(tempPath, { force: true });
      }
    });
    this.writeQueue = write.catch(() => {});
    await write;
    return structuredClone(run);
  }
}