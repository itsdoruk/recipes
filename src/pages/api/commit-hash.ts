import { exec } from 'child_process';
import { promisify } from 'util';
import type { NextApiRequest, NextApiResponse } from 'next';

const execAsync = promisify(exec);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { stdout } = await execAsync('git rev-parse HEAD');
    const fullHash = stdout.trim();
    const shortHash = fullHash.substring(0, 7);
    res.status(200).json({ hash: shortHash });
  } catch (error) {
    console.error('Failed to get commit hash:', error);
    res.status(500).json({ error: 'Failed to get commit hash' });
  }
} 