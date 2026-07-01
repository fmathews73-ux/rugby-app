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

  // Guardrail: refuse to run against the synthetic dataset while claiming
  // to be production. Any store-bound build must not import this dataset.
  const node_env = process.env['NODE_ENV'] ?? 'development';
  const looksLikeSynthetic = data_dir.includes('pipeline/data');
  if (node_env === 'production' && looksLikeSynthetic) {
    throw new Error(
      'Refusing to start: NODE_ENV=production with DATA_DIR pointing at synthetic ' +
        'dataset. This dataset is dev-only (PRD §5.5). See root CLAUDE.md §9.',
    );
  }

  return {
    port,
    data_dir,
    data_source: looksLikeSynthetic ? 'synthetic' : 'real',
    log_level: (process.env['LOG_LEVEL'] as Config['log_level']) ?? 'info',
  };
}
