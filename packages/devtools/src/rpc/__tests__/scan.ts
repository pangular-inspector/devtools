interface SourceQuery<R> {
  name: string;
  setup?: (context: never) => { handler?: () => R } | PromiseLike<{ handler?: () => R }>;
}

export async function scan<R>(query: SourceQuery<R>, cwd: string): Promise<Awaited<R>> {
  const { handler } = (await query.setup?.({ cwd } as never)) ?? {};
  if (!handler) throw new Error(`${query.name} has no handler`);
  return await handler();
}
