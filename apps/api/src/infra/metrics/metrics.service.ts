import { Injectable } from '@nestjs/common';

interface HttpMetricKey {
  method: string;
  route: string;
  statusCode: number;
}

@Injectable()
export class MetricsService {
  private readonly startedAt = Date.now();
  private readonly httpCounters = new Map<string, { key: HttpMetricKey; count: number; durationMs: number }>();

  observeHttpRequest(method: string, route: string, statusCode: number, durationMs: number): void {
    const normalizedRoute = route || 'desconhecida';
    const id = `${method}|${normalizedRoute}|${statusCode}`;
    const current = this.httpCounters.get(id) ?? {
      key: { method, route: normalizedRoute, statusCode },
      count: 0,
      durationMs: 0,
    };

    current.count += 1;
    current.durationMs += durationMs;
    this.httpCounters.set(id, current);
  }

  toPrometheus(): string {
    const lines: string[] = [
      '# HELP fad_api_uptime_seconds Tempo de atividade do processo da API.',
      '# TYPE fad_api_uptime_seconds gauge',
      `fad_api_uptime_seconds ${Math.floor((Date.now() - this.startedAt) / 1000)}`,
      '# HELP fad_http_requests_total Total de requisições HTTP processadas.',
      '# TYPE fad_http_requests_total counter',
    ];

    for (const { key, count } of this.httpCounters.values()) {
      lines.push(
        `fad_http_requests_total{method="${escapeLabel(key.method)}",route="${escapeLabel(key.route)}",status="${key.statusCode}"} ${count}`,
      );
    }

    lines.push(
      '# HELP fad_http_request_duration_ms_sum Soma da duração das requisições HTTP em milissegundos.',
      '# TYPE fad_http_request_duration_ms_sum counter',
    );

    for (const { key, durationMs } of this.httpCounters.values()) {
      lines.push(
        `fad_http_request_duration_ms_sum{method="${escapeLabel(key.method)}",route="${escapeLabel(key.route)}",status="${key.statusCode}"} ${durationMs.toFixed(3)}`,
      );
    }

    return `${lines.join('\n')}\n`;
  }
}

function escapeLabel(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n');
}
