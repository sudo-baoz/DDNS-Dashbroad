export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (process.env.ENABLE_WORKER !== 'false') {
      const { startDDNSScheduler } = await import('./lib/scheduler');
      startDDNSScheduler();
    }
  }
}
