/**
 * Metro config for the mobile app.
 *
 * We keep `mobile/` OUT of the root npm workspaces so Expo / Metro see a
 * clean self-contained node_modules. But we still want types (and any
 * future runtime helpers) from `packages/shared` — so:
 *
 * - `watchFolders` adds `packages/shared` so Metro observes file changes
 *   there and triggers Fast Refresh when types (or any shared code) move.
 * - Actual import resolution is done by `babel-plugin-module-resolver`
 *   (see babel.config.js) — types-only imports never hit Metro anyway.
 */
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [path.join(workspaceRoot, 'packages', 'shared')];

module.exports = config;
