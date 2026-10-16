import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const script = readFileSync(new URL('./deploy-linux.sh', import.meta.url), 'utf8');
const validation = script.match(/^if grep -Eq '[^']+' "\$ENV_FILE"; then[\s\S]*?^fi\r?$/m)?.[0];
assert.ok(validation, 'Deployment environment validation must exist');
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';

function validate(contents) {
  const directory = mkdtempSync(join(tmpdir(), 'openfire-deploy-test-'));
  try {
    const path = join(directory, 'test.env');
    writeFileSync(path, contents);
    const result = spawnSync(bash, ['-c', validation.replaceAll('\r', '')], {
      env: { ...process.env, ENV_FILE: path.replaceAll('\\', '/') }, encoding: 'utf8',
    });
    if (result.error) throw result.error;
    return result;
  } finally {
    rmSync(directory, { recursive: true });
  }
}

test('Jenius deployments do not require the obsolete local password hash', () => {
  assert.equal(validate('APP_PASSWORD_HASH=generated-salted-sha256-hash\n').status, 0);
});

for (const value of [
  'POSTGRES_PASSWORD=change-me',
  'FRED_API_KEY=your-fred-key',
  'FINNHUB_API_KEY=your-finnhub-key',
  'KEYCLOAK_ADMIN_PASSWORD=your_existing_keycloak_admin_password',
]) {
  test(`still rejects the required placeholder for ${value.split('=')[0]}`, () => {
    const result = validate(value + '\n');
    assert.equal(result.status, 2);
    assert.match(result.stderr, /still contains template placeholders/);
  });
}

test('accepts configured values without treating comments as placeholders', () => {
  assert.equal(validate([
    '# POSTGRES_PASSWORD=change-me',
    'POSTGRES_PASSWORD=test-only',
    'FRED_API_KEY=test-only',
    'FINNHUB_API_KEY=test-only',
    'KEYCLOAK_ADMIN_PASSWORD=test-only',
  ].join('\n')).status, 0);
});
