import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/securecode.db');

export let db: sqlite3.Database;

type SqlParam = string | number | boolean | Buffer | null;

interface RunResult {
  id: number;
  changes: number;
}

export const initializeDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });

    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Erro ao conectar ao banco de dados:', err);
        reject(err);
      } else {
        console.log('✅ Conectado ao banco de dados SQLite');
        createTables()
          .then(() => resolve())
          .catch(reject);
      }
    });
  });
};

const createTables = async (): Promise<void> => {
  const run = promisify(db.run.bind(db));

  try {
    // Tabela de prompts e análises
    await run(`
      CREATE TABLE IF NOT EXISTS prompts (
        id TEXT PRIMARY KEY,
        user_input TEXT NOT NULL,
        risk_level TEXT NOT NULL,
        is_injection_detected BOOLEAN DEFAULT FALSE,
        injection_type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de respostas geradas
    await run(`
      CREATE TABLE IF NOT EXISTS code_responses (
        id TEXT PRIMARY KEY,
        prompt_id TEXT NOT NULL,
        generated_code TEXT,
        language TEXT,
        is_vulnerable BOOLEAN DEFAULT FALSE,
        vulnerabilities TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (prompt_id) REFERENCES prompts(id)
      )
    `);

    // Tabela de correções de código
    await run(`
      CREATE TABLE IF NOT EXISTS code_corrections (
        id TEXT PRIMARY KEY,
        response_id TEXT NOT NULL,
        vulnerability_type TEXT NOT NULL,
        vulnerability_description TEXT,
        secure_code TEXT,
        owasp_category TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (response_id) REFERENCES code_responses(id)
      )
    `);

    // Tabela de logs de segurança
    await run(`
      CREATE TABLE IF NOT EXISTS security_logs (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        message TEXT,
        ip_address TEXT,
        user_agent TEXT,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de estatísticas
    await run(`
      CREATE TABLE IF NOT EXISTS statistics (
        id TEXT PRIMARY KEY,
        total_prompts INTEGER DEFAULT 0,
        total_attacks_blocked INTEGER DEFAULT 0,
        total_vulnerabilities_detected INTEGER DEFAULT 0,
        total_corrections INTEGER DEFAULT 0,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Inserir registro inicial de estatísticas
    await run(`
      INSERT OR IGNORE INTO statistics (id)
      VALUES ('stats')
    `);

    console.log('✅ Tabelas criadas com sucesso');
  } catch (error) {
    console.error('Erro ao criar tabelas:', error);
    throw error;
  }
};

export const query = <T = unknown>(sql: string, params: SqlParam[] = []): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
};

export const run = (sql: string, params: SqlParam[] = []): Promise<RunResult> => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

export const getOne = <T = unknown>(sql: string, params: SqlParam[] = []): Promise<T | undefined> => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T | undefined);
    });
  });
};
