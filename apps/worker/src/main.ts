const now = new Date().toISOString();
console.log(`[${now}] worker: processo iniciado.`);
console.log('worker: consumidores RabbitMQ serão registrados na etapa de mensageria.');

// Mantém o processo ativo durante `pnpm dev`, sem conectar à fila antes da etapa própria.
setInterval(() => undefined, 60_000);
