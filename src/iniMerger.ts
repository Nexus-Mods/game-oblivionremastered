import * as ini from 'ini';
import * as path from 'path';
import { fs } from 'vortex-api';

const SUPPORTED_INI_FILES = [
  'Altar.ini',
];

export async function 

export async function mergeIniFilesAsync(filePaths: string[]): Promise<Record<string, any>> {
  const mergedConfig: Record<string, any> = {};

  for (const filePath of filePaths) {
    try {
      const content = await fs.readFileAsync(filePath, 'utf-8');
      const parsed = ini.parse(content);
      mergeObjects(mergedConfig, parsed);
    } catch (err) {
      console.warn(`Could not read or parse file: ${filePath}`, err);
    }
  }

  return mergedConfig;
}

function mergeObjects(target: Record<string, any>, source: Record<string, any>) {
  for (const key of Object.keys(source)) {
    if (typeof source[key] === 'object'
      && !Array.isArray(source[key])
      && source[key] !== null) {
      if (!target[key]) {
        target[key] = {};
      }
      mergeObjects(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}
