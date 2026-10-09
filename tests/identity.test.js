import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameParts, credentialsFor } from '../src/identity.js';
test('names produce consistent serial namespaces', () => {
  assert.deepEqual(nameParts('  Ruchi  '), { displayName:'Ruchi', stem:'RUCHI' });
  assert.equal(nameParts('Rúchi').stem, 'RUCHI');
  assert.equal(nameParts('Ruchi Singh').stem, 'RUCHISINGH');
  for (const value of ['', '1', '<script>', 'A'.repeat(41), '李']) assert.throws(() => nameParts(value));
});
test('ID-only credentials are consistent and reject malformed IDs', () => {
  assert.deepEqual(credentialsFor(' neetxruchi01 '), credentialsFor('NEETXRUCHI01'));
  assert.notEqual(credentialsFor('NEETXRUCHI01').email,credentialsFor('NEETXRUCHI02').email);
  for (const id of ['RUCHI','NEETXRUCHI','NEETXRUCHI01/other','study_old']) assert.throws(() => credentialsFor(id));
  assert.deepEqual(credentialsFor('maalkin'), credentialsFor('NEETXSOFTYBABY01'));
  assert.deepEqual(credentialsFor('Maalkin'), credentialsFor('NEETXSOFTYBABY01'));
  assert.deepEqual(credentialsFor('softybaby'), credentialsFor('NEETXSOFTYBABY01'));
  assert.deepEqual(credentialsFor('softy-baby'), credentialsFor('NEETXSOFTYBABY01'));
});

