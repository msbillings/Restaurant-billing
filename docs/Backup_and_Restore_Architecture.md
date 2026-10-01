# Backup and Restore Architecture

This document describes the Phase 4 secure, tenant-isolated backup and restore architecture for the MS Billings platform.

## Architecture Overview

The system uses a decentralized tenant-by-tenant approach for disaster recovery, isolating each tenant's data into its own encrypted physical payload on disk.

1. **Trigger**: Handled daily at 03:00 via a node-cron job in `backupManager.js`.
2. **Authoritative Discovery**: The system queries the `Client` collection on the Master DB (cluster0) for all tenants with `status: 'Active'`.
3. **Data Scope**: Extracts core operational data (Bills, Menus, Inventory, Users, Settings, CRM, Logs).
4. **Encryption Format**: AES-256-GCM symmetric encryption using a 32-byte hexadecimal key provided strictly via `process.env.BACKUP_ENCRYPTION_KEY`.
5. **Storage Abstraction**: Currently persists to the local disk/persistent volume mapped at `APP_USER_DATA_PATH/backups`.
6. **Integrity/Safety**: Write operations are purely atomic. A temporary `.tmp` file is completely assembled, hashed, and written before being renamed to `.enc`. If an exception occurs, the `.tmp` is immediately unlinked.

## Encrypted Format Specification

Backups are saved as `backup_<UUID>.enc`.

The binary format is defined as:
`[VERSION (1 byte)] + [IV (16 bytes)] + [AUTH_TAG (16 bytes)] + [CIPHERTEXT]`

Upon decryption, the payload evaluates to a JSON document:
```json
{
  "metadata": {
    "version": "1.0",
    "backupId": "UUID",
    "createdAt": "ISO-DATE",
    "tenantId": "databaseName",
    "cluster": "clusterName",
    "collections": {
      "Bill": { "count": 1500 }
    },
    "checksum": "SHA-256 string"
  },
  "data": {
    "Bill": [...],
    ...
  }
}
```

## Restore Process

A restore utility (`utils/restoreManager.js`) has been provided for recovery.

**Safety Controls:**
1. It is **NOT** exposed via HTTP or API. It must be executed via internal CLI or test suite.
2. It explicitly checks for existing documents in the target collections. By default, it refuses to overwrite existing data unless the `force` flag is provided.
3. The restore prefers targeting staging or test databases isolated from active production workloads.
4. Validation occurs at multiple layers: Cipher authentication, Checksum SHA-256 validation, and Post-insertion row count matching.

## Retention Policy

The retention script operates **per tenant**.
It parses the decrypted metadata for all local `.enc` files and guarantees that the last 7 *successful* backups are kept for each unique `tenantId`.

## Test Strategy

Tests in `tests/utils/backupManager.test.js` mock the Master `Client` database and `tenantManager` logic to simulate various failures (encryption tampering, database timeout, missing tenant, overwrite rejection). **No tests connect to production.**

## Known Limitations & Future Improvements

1. **Local Storage**: The current `fs`-based system writes to a persistent disk. This is not fully durable against a total data-center loss.
2. **Future Object Storage**: The abstraction should be updated in a future phase to push the finalized `.enc` file to an S3/R2 bucket utilizing an object storage SDK.
3. **Master Database Backup**: The tenant backup engine isolates operational data. **The Master Database (Clients, Licenses, Global Reports) still requires a dedicated, independent backup strategy.**
