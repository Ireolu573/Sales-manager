#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';

const MCP_URL = process.env.MCP_URL || process.env.MCP_ENDPOINT;
const MCP_TOKEN = process.env.MCP_TOKEN || process.env.MCP_AUTH_TOKEN;
const ROOT = process.cwd();
const ENV_FILE = path.join(ROOT, '.env.local');

function parseEnv(content) {
  const lines = content.split(/\r?\n/);
  const map = new Map();
  for (const line of lines) {
    if (!line || line.trim().startsWith('#') || !line.includes('=')) continue;
    const idx = line.indexOf('=');
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1);
    map.set(k, v);
  }
  return map;
}

function serializeEnv(map) {
  let out = '';
  for (const [k, v] of map.entries()) {
    out += `${k}=${v}\n`;
  }
  return out;
}

async function fetchSecrets() {
  if (!MCP_URL || !MCP_TOKEN) {
    console.error('Missing MCP_URL or MCP_TOKEN. Set them in your environment and retry.');
    process.exit(1);
  }

  const url = `${MCP_URL.replace(/\/$/, '')}/v1/secrets/db`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${MCP_TOKEN}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`MCP request failed: ${res.status} ${res.statusText} - ${body}`);
  }

  const data = await res.json();
  if (typeof data !== 'object' || data === null) throw new Error('Invalid secrets response');
  return data;
}

async function main() {
  try {
    const secrets = await fetchSecrets();

    // Read existing env file if present
    let existing = new Map();
    try {
      const cur = await fs.readFile(ENV_FILE, 'utf8');
      existing = parseEnv(cur);
    } catch (e) {
      // ignore if file missing
    }

    // Merge secrets into env map (stringify values if necessary)
    for (const [k, v] of Object.entries(secrets)) {
      existing.set(k, String(v));
    }

    // Ensure we keep VITE_* keys for frontend if provided
    const output = serializeEnv(existing);
    await fs.writeFile(ENV_FILE, output, { encoding: 'utf8', mode: 0o600 });
    console.log(`Wrote secrets to ${ENV_FILE}. Do not commit this file.`);
    console.log('Next: run your migration or start the app.');
  } catch (err) {
    console.error('Error fetching secrets from MCP:', err.message || err);
    process.exit(1);
  }
}

if (require.main === module) main();
