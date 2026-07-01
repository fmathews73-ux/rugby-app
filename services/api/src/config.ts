import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Runtime configuration derived from env with safe defaults.
 *
 * SAFETY: `data_source` reflects where the payloads originate. As long as
 * this service reads from `services/pipeline/data`, that is 'synthetic' —
 * clients rely on this to gate their dev-mode indicator. Do NOT report
 * 'real' unless the data path has actually been switched to a licensed
 * feed's output (PRD §5.5, root CLAUDE.md §9).
 */
export interface Config {
  port: number;
  data_dir: string;
  data_source: 'synthetic' | 'real';
  log_level: 'debug' | 'info' | 'warn' | 'error';
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = resolve(join(__dirname, '..', '..', 'pipeline', 'data'));

export function loadConfig(): Config {
  const port = Number(process.env['PORT'] ?? 3000);
  const data_dir = process.env['DATA_DIR'] ?? DEFAULT_DATA_DIR;

  // Guardrail: refuse to run against the synthetic dataset while claiming to
  // be production, UNLESS the operator has explicitly opted in via
  // ALLOW_SYNTHETIC_DATA=1. The opt-in must be present at every stage-4-style
  // dev deploy and MUST be removed before the real-data cutover — root
  // CLAUDE.md §9, PRD §5.5.
  const node_env = process.env['NODE_ENV'] ?? 'development';
  const looksLikeSynthetic = data_dir.includes('pipeline/data');
  const allowSynthetic = process.env['ALLOW_SYNTHETIC_DATA'] === '1';
  if (node_env === 'production' && looksLikeSynthetic && !allowSynthetic) {
    throw new Error(
      'Refusing to start: NODE_ENV=production with DATA_DIR pointing at synthetic ' +
        'dataset and ALLOW_SYNTHETIC_DATA not set. This dataset is dev-only ' +
        '(PRD §5.5). See root CLAUDE.md §9.',
    );
  }

  return {
    port,
    data_dir,
    data_source: looksLikeSynthetic ? 'synthetic' : 'real',
    log_level: (process.env['LOG_LEVEL'] as Config['log_level']) ?? 'info',
  };
}
