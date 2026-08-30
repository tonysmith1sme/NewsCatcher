import { PrismaClient } from '@prisma/client';
import { prepareRuntime } from '../runtime';

let client: PrismaClient | null = null;

function getClient(): PrismaClient {
  if (!client) {
    prepareRuntime();
    client = new PrismaClient();
  }
  return client;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    if (prop === 'then') return undefined;
    const instance = getClient() as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === 'function' ? (value as Function).bind(instance) : value;
  },
});

export async function getSystemConfig(key: string, defaultValue: string = ''): Promise<string> {
  const cfg = await prisma.config.findUnique({ where: { key } });
  return cfg ? cfg.value : defaultValue;
}

export async function setSystemConfig(key: string, value: string): Promise<void> {
  await prisma.config.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}
