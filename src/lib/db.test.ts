// convertToPostgres() is a pure string transform, but importing db.ts also runs
// module-level side effects (constructs a real pg.Pool and fires a 'SELECT 1'
// probe against Neon). Mock 'pg' so importing this file for its pure function
// stays a real unit test — no network, no dangling connection/open handle.
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn().mockResolvedValue({ rows: [] }),
    on: jest.fn(),
    end: jest.fn().mockResolvedValue(undefined),
    connect: jest.fn(),
  })),
}));

import { convertToPostgres } from './db';

describe('convertToPostgres', () => {
  it('converts ? placeholders to $1, $2, ... in order', () => {
    const { text } = convertToPostgres('SELECT * FROM Users WHERE id = ? AND role = ?', ['u1', 'admin']);
    expect(text).toContain('$1');
    expect(text).toContain('$2');
  });

  it('passes through the original params array unchanged', () => {
    const { values } = convertToPostgres('SELECT * FROM Users WHERE id = ?', ['u1']);
    expect(values).toEqual(['u1']);
  });

  it('auto-quotes known PascalCase table names', () => {
    const { text } = convertToPostgres('SELECT * FROM Users WHERE id = ?', ['u1']);
    expect(text).toContain('"Users"');
  });

  it('auto-quotes known camelCase column names', () => {
    const { text } = convertToPostgres('SELECT * FROM Tasks WHERE projectId = ?', ['p1']);
    expect(text).toContain('"projectId"');
  });

  it('converts backtick-quoted identifiers to double-quotes', () => {
    const { text } = convertToPostgres('SELECT * FROM `Users` WHERE `role` = ?', ['admin']);
    expect(text).toContain('"Users"');
    expect(text).toContain('"role"');
  });

  it('converts IN (?) to = ANY(?) for array parameters', () => {
    const { text } = convertToPostgres('SELECT * FROM Tasks WHERE id IN (?)', [['t1', 't2']]);
    expect(text).toContain('= ANY($1)');
  });

  // Known landmine (flagged in the security/database audit, not yet fixed): the
  // IN (?) -> = ANY(?) regex has no negative lookbehind for "NOT ", so it also
  // matches inside "NOT IN (?)" and corrupts it into invalid Postgres syntax.
  // This test documents the current (broken) behavior so a future fix shows up
  // as an intentional, visible diff here instead of silently changing behavior.
  it('[KNOWN ISSUE] currently mis-converts "NOT IN (?)" into invalid syntax', () => {
    const { text } = convertToPostgres('SELECT * FROM Tasks WHERE status NOT IN (?)', [['Done']]);
    // Documents the bug: this produces "NOT = ANY($1)", not valid Postgres SQL.
    expect(text).toContain('NOT = ANY($1)');
  });

  it('converts TINYINT(1) to BOOLEAN', () => {
    const { text } = convertToPostgres('CREATE TABLE x (flag TINYINT(1))');
    expect(text).toContain('BOOLEAN');
  });

  it('converts INSERT IGNORE to INSERT', () => {
    const { text } = convertToPostgres('INSERT IGNORE INTO Users (id) VALUES (?)', ['u1']);
    expect(text.toUpperCase()).not.toContain('INSERT IGNORE');
    expect(text.toUpperCase()).toContain('INSERT INTO');
  });

  // [KNOWN ISSUE] The SHOW TABLES rule rewrites the query to an
  // information_schema.tables SELECT aliased as "Tables_in_defaultdb" — but the
  // very next rule in the same function matches any text containing
  // "information_schema.tables" and overwrites it with the pg_class table-stats
  // query, so the intended alias never survives. Documented here so a future fix
  // surfaces as an intentional diff rather than a silent behavior change.
  it('[KNOWN ISSUE] SHOW TABLES ends up as the pg_class stats query, losing its intended alias', () => {
    const { text } = convertToPostgres('SHOW TABLES');
    expect(text).toContain('pg_class');
    expect(text).not.toContain('Tables_in_defaultdb');
  });
});
