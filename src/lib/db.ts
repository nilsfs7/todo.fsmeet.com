import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import mysql, { type Pool, type PoolConnection, type ResultSetHeader } from "mysql2/promise";

export type SqlValue = string | number | null;

export type Sql = {
  get<T>(sql: string, params?: SqlValue[]): Promise<T | undefined>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  run(sql: string, params?: SqlValue[]): Promise<{ changes: number }>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
};

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(80) NOT NULL PRIMARY KEY,
    username VARCHAR(80) NOT NULL,
    display_name VARCHAR(200) NULL,
    email VARCHAR(320) NULL,
    picture TEXT NULL,
    created_at VARCHAR(40) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT NULL,
    owner_id VARCHAR(80) NOT NULL,
    public_read TINYINT NOT NULL DEFAULT 0,
    created_at VARCHAR(40) NOT NULL,
    CONSTRAINT fk_projects_owner FOREIGN KEY (owner_id) REFERENCES users (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS memberships (
    project_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(80) NOT NULL,
    role VARCHAR(8) NOT NULL,
    created_at VARCHAR(40) NOT NULL,
    PRIMARY KEY (project_id, user_id),
    CONSTRAINT fk_memberships_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    CONSTRAINT fk_memberships_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT chk_membership_role CHECK (role IN ('read', 'edit'))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL,
    creator_id VARCHAR(80) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NULL,
    effort VARCHAR(8) NULL,
    category VARCHAR(80) NULL,
    column_name VARCHAR(20) NOT NULL,
    position INT NOT NULL,
    created_at VARCHAR(40) NOT NULL,
    started_at VARCHAR(40) NULL,
    completed_at VARCHAR(40) NULL,
    assignee_id VARCHAR(80) NULL,
    CONSTRAINT fk_tasks_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    CONSTRAINT fk_tasks_creator FOREIGN KEY (creator_id) REFERENCES users (id),
    CONSTRAINT fk_tasks_assignee FOREIGN KEY (assignee_id) REFERENCES users (id),
    CONSTRAINT chk_task_effort CHECK (effort IS NULL OR effort IN ('xs', 's', 'm', 'l', 'xl')),
    CONSTRAINT chk_task_column CHECK (column_name IN ('backlog', 'in_progress', 'done'))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS comments (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    task_id VARCHAR(36) NOT NULL,
    author_id VARCHAR(80) NOT NULL,
    body TEXT NOT NULL,
    created_at VARCHAR(40) NOT NULL,
    updated_at VARCHAR(40) NULL,
    CONSTRAINT fk_comments_task FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
    CONSTRAINT fk_comments_author FOREIGN KEY (author_id) REFERENCES users (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  "CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks (project_id, column_name, position)",
  "CREATE INDEX IF NOT EXISTS idx_comments_task ON comments (task_id, created_at)",
  "CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects (owner_id)",
];

type ConnectionConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database?: string;
};

const txStorage = new AsyncLocalStorage<PoolConnection>();

function databaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is required, for example mysql://todo:password@127.0.0.1:3308/todo");
  }
  return url;
}

function parseDatabaseUrl(value: string): ConnectionConfig & { database: string } {
  const url = new URL(value);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (url.protocol !== "mysql:") throw new Error("DATABASE_URL must start with mysql://");
  if (!database) throw new Error("DATABASE_URL is missing a database name");
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
  };
}

async function ensureSchema(pool: Pool): Promise<void> {
  for (const statement of SCHEMA) {
    await pool.query(statement);
  }
}

function createSql(pool: Pool, ready: Promise<void>, cleanup?: () => Promise<void>): Sql {
  async function query(sqlText: string, params: SqlValue[] = []): Promise<unknown> {
    await ready;
    const executor = txStorage.getStore() ?? pool;
    const [rows] = await executor.query(sqlText, params);
    return rows;
  }

  return {
    async get<T>(sqlText: string, params?: SqlValue[]): Promise<T | undefined> {
      const rows = (await query(sqlText, params)) as T[];
      return rows[0];
    },
    async all<T>(sqlText: string, params?: SqlValue[]): Promise<T[]> {
      return (await query(sqlText, params)) as T[];
    },
    async run(sqlText: string, params?: SqlValue[]): Promise<{ changes: number }> {
      const result = (await query(sqlText, params)) as ResultSetHeader;
      return { changes: result.affectedRows };
    },
    async transaction<T>(fn: () => Promise<T>): Promise<T> {
      await ready;
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const value = await txStorage.run(connection, fn);
        await connection.commit();
        return value;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },
    async close(): Promise<void> {
      try {
        await pool.end();
      } finally {
        if (cleanup) await cleanup();
      }
    },
  };
}

const globalForDb = globalThis as unknown as { todoDb?: Sql };

export function getDb(): Sql {
  if (!globalForDb.todoDb) {
    const config = parseDatabaseUrl(databaseUrl());
    const pool = mysql.createPool({ ...config, connectionLimit: 10, charset: "utf8mb4" });
    globalForDb.todoDb = createSql(pool, ensureSchema(pool));
  }
  return globalForDb.todoDb;
}

function testAdminConfig(): ConnectionConfig {
  const fromUrl = process.env.DATABASE_URL?.trim();
  const parsed = fromUrl ? parseDatabaseUrl(fromUrl) : null;
  return {
    host: parsed?.host ?? "127.0.0.1",
    port: parsed?.port ?? 3308,
    user: process.env.MARIADB_ADMIN_USER ?? "root",
    password: process.env.MARIADB_ADMIN_PASSWORD ?? "root",
  };
}

async function dropDatabase(config: ConnectionConfig, name: string): Promise<void> {
  const connection = await mysql.createConnection(config);
  try {
    await connection.query(`DROP DATABASE IF EXISTS \`${name}\``);
  } finally {
    await connection.end();
  }
}

export async function openTestDatabase(): Promise<Sql> {
  const admin = testAdminConfig();
  const name = `todo_test_${randomUUID().replaceAll("-", "")}`;
  const connection = await mysql.createConnection(admin);
  try {
    await connection.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } finally {
    await connection.end();
  }
  const pool = mysql.createPool({ ...admin, database: name, connectionLimit: 4, charset: "utf8mb4" });
  return createSql(pool, ensureSchema(pool), () => dropDatabase(admin, name));
}
