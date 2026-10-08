import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameParts, credentialsFor, checkNameForId } from '../src/identity.js';
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
});
test('login asks for a matching name', () => {
  checkNameForId('Ruchi','neetxruchi01');
  assert.throws(()=>checkNameForId('Priya','NEETXRUCHI01'));
});
