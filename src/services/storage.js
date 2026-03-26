/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { getRuntimeConfig } = require('../config/env');

const baseDirectory = path.resolve(process.cwd(), getRuntimeConfig().dataDirectory);

async function ensureParentDirectory(filePath) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function readJson(relativePath) {
    const filePath = path.join(baseDirectory, relativePath);
    try {
        const raw = await fs.readFile(filePath, 'utf8');
        return JSON.parse(raw);
    } catch (error) {
        if (error && error.code === 'ENOENT') {
            return null;
        }

        throw error;
    }
}

async function writeJson(relativePath, value) {
    const filePath = path.join(baseDirectory, relativePath);
    await ensureParentDirectory(filePath);
    await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
    return { ok: true, filePath };
}

function normalizeStoreKey(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function createScopedStore(prefix) {
    return {
        read(key) {
            return readJson(path.posix.join(prefix, `${key}.json`));
        },
        write(key, value) {
            return writeJson(path.posix.join(prefix, `${key}.json`), value);
        }
    };
}

const storageService = {
    readJson,
    writeJson,
    normalizeStoreKey,
    predictions: createScopedStore('predictions'),
    snapshots: createScopedStore('snapshots'),
    bilans: createScopedStore('bilans'),
    stats: createScopedStore('stats'),
    poids: createScopedStore('poids'),
    chevaux: createScopedStore('chevaux')
};

module.exports = {
    storageService
};
