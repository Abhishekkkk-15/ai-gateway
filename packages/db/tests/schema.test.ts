import { describe, it, expect } from 'vitest';
import {
  providersTable,
  modelsTable,
  gatewayKeysTable,
  requestLogsTable,
  adminUsersTable,
} from '../src/schema.js';

describe('Drizzle Database Schema Definitions', () => {
  it('exports all expected database tables', () => {
    expect(providersTable).toBeDefined();
    expect(modelsTable).toBeDefined();
    expect(gatewayKeysTable).toBeDefined();
    expect(requestLogsTable).toBeDefined();
    expect(adminUsersTable).toBeDefined();
  });
});
