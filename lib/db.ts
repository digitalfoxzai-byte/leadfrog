import mysql from 'mysql2/promise'

let pool: mysql.Pool | null = null

export function getDb() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'leadfrog',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'leadfrog_db',
      waitForConnections: true,
      connectionLimit: 10,
    })
  }
  return pool
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function query<T = unknown>(sql: string, values?: any[]): Promise<T> {
  const db = getDb()
  const [rows] = await db.execute(sql, values)
  return rows as T
}
