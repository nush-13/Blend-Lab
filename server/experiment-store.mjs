import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export class ExperimentStore {
  constructor(filePath) { this.filePath = filePath; this.experiments = null; this.writeQueue = Promise.resolve(); }
  async load() {
    if (this.experiments !== null) return;
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8'));
      if (!Array.isArray(parsed)) throw new Error('Experiment store must contain an array.');
      this.experiments = parsed;
    } catch (error) { if (error.code === 'ENOENT') this.experiments = []; else throw error; }
  }
  async list() { await this.load(); await this.writeQueue; return structuredClone([...this.experiments].sort((a,b) => b.createdAt.localeCompare(a.createdAt))); }
  async get(id) { await this.load(); await this.writeQueue; const item = this.experiments.find(exp => exp.id === id); return item ? structuredClone(item) : null; }
  async create(experiment) {
    await this.load();
    const saved = { ...structuredClone(experiment), id: randomUUID(), createdAt: new Date().toISOString() };
    this.experiments.unshift(saved);
    const write = this.writeQueue.then(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      const temp = `${this.filePath}.${randomUUID()}.tmp`;
      try { await writeFile(temp, JSON.stringify(this.experiments), 'utf8'); await rename(temp, this.filePath); }
      finally { await rm(temp, { force: true }); }
    });
    this.writeQueue = write.catch(() => {});
    try { await write; } catch (error) { this.experiments = this.experiments.filter(item => item.id !== saved.id); throw error; }
    return structuredClone(saved);
  }
  async delete(id) {
    await this.load();
    const original = this.experiments;
    this.experiments = original.filter(item => item.id !== id);
    if (this.experiments.length === original.length) return false;
    const write = this.writeQueue.then(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      const temp = `${this.filePath}.${randomUUID()}.tmp`;
      try { await writeFile(temp, JSON.stringify(this.experiments), 'utf8'); await rename(temp, this.filePath); }
      finally { await rm(temp, { force: true }); }
    });
    this.writeQueue = write.catch(() => {});
    try { await write; } catch (error) { this.experiments = original; throw error; }
    return true;
  }
}
