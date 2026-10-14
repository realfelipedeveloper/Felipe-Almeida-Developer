import { createServer, type Server } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { logger } from './logger.js';
import { workerMetrics, type WorkerMetrics } from './worker-metrics.js';

export class ManagementServer {
  private server: Server | null = null;

  constructor(
    private readonly readiness: () => Promise<boolean>,
    private readonly metrics: WorkerMetrics = workerMetrics,
  ) {}

  async start(): Promise<void> {
    if (this.server) return;
    const host = process.env.WORKER_MANAGEMENT_HOST?.trim() || '127.0.0.1';
    const port = Number(process.env.WORKER_MANAGEMENT_PORT ?? 9464);
    if (!Number.isInteger(port) || port < 0 || port > 65_535) {
      throw new Error('WORKER_MANAGEMENT_PORT precisa ser uma porta válida.');
    }

    this.server = createServer(async (request, response) => {
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('X-Content-Type-Options', 'nosniff');

      if (request.url === '/health/live') {
        this.json(response, 200, { status: 'ok', service: 'felipe-almeida-developer-worker' });
        return;
      }
      if (request.url === '/health/ready') {
        const ready = await this.readiness().catch(() => false);
        this.json(response, ready ? 200 : 503, { status: ready ? 'ok' : 'degraded' });
        return;
      }
      if (request.url === '/metrics' && process.env.METRICS_ENABLED !== 'false') {
        if (!this.authorized(request.headers['x-metrics-token'])) {
          this.json(response, 401, { status: 'unauthorized' });
          return;
        }
        response.statusCode = 200;
        response.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        response.end(this.metrics.toPrometheus());
        return;
      }
      this.json(response, 404, { status: 'not_found' });
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(port, host, () => {
        this.server!.off('error', reject);
        resolve();
      });
    });
    logger.info({ categoria: 'app', host, port }, 'Servidor de gestão do worker iniciado');
  }

  async stop(): Promise<void> {
    const server = this.server;
    this.server = null;
    if (!server) return;
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }

  getPort(): number | null {
    const address = this.server?.address();
    return address && typeof address === 'object' ? address.port : null;
  }

  private authorized(header: string | string[] | undefined): boolean {
    if (process.env.NODE_ENV !== 'production') return true;
    const expected = process.env.METRICS_TOKEN ?? '';
    const received = Array.isArray(header) ? (header[0] ?? '') : (header ?? '');
    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(received);
    return (
      expectedBuffer.length > 0 &&
      expectedBuffer.length === receivedBuffer.length &&
      timingSafeEqual(expectedBuffer, receivedBuffer)
    );
  }

  private json(
    response: import('node:http').ServerResponse,
    statusCode: number,
    body: Record<string, string>,
  ): void {
    response.statusCode = statusCode;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify(body));
  }
}
