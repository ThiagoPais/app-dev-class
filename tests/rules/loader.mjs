// Lets Node run forum.service.ts against the emulator: '@/services/firebase'
// resolves to a stub, and extensionless relative imports resolve to .ts files.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const stub = new URL('./firebase-stub.mjs', import.meta.url).href;

export async function resolve(specifier, context, next) {
  if (specifier === '@/services/firebase') return { url: stub, shortCircuit: true };
  if (specifier.startsWith('.') && context.parentURL?.endsWith('.ts')) {
    const candidate = new URL(`${specifier}.ts`, context.parentURL);
    if (existsSync(fileURLToPath(candidate))) return { url: candidate.href, shortCircuit: true };
  }
  return next(specifier, context);
}
