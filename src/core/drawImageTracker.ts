const collectors: Set<string>[] = [];

export function recordDrawImage(url: unknown) {
  if (typeof url !== 'string') return;
  for (const collector of collectors) collector.add(url);
}

export function collectDrawImages<T>(draw: () => T): {result: T; urls: string[]} {
  const collector = new Set<string>();
  collectors.push(collector);
  try {
    return {result: draw(), urls: [...collector]};
  } finally {
    collectors.pop();
  }
}
