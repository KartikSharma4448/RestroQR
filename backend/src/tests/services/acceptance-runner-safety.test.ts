import { spawnSync } from 'child_process';
import path from 'path';

describe('PostgreSQL acceptance runner target guard', () => {
  it.each([
    '',
    'postgresql://user:fake@production.example.test/restroqr_auth_acceptance_test',
    'postgresql://user:fake@127.0.0.1/production',
    'http://127.0.0.1/restroqr_auth_acceptance_test',
    'postgresql://user:fake@127.0.0.1/restroqr_auth_acceptance_test?host=production.example.test',
  ])('refuses unsafe or missing target without starting migrations', (target) => {
    const result = spawnSync(process.execPath, [path.resolve('scripts/run-auth-acceptance.cjs')], {
      env: { ...process.env, RESTROQR_ACCEPTANCE_DATABASE_URL: target },
      encoding: 'utf8', timeout: 5000,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/disposable|Refusing/);
    expect(result.stdout).not.toContain('MIGRATION');
  });
});
