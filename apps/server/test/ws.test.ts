import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import WebSocket from 'ws';
import { API, WS_CLOSE, type ServerMessage } from '@restaurant/contracts';
import { makeApp } from './helpers.js';

interface Client {
  socket: WebSocket;
  /** Resolves with the next `count` messages (already received ones first). */
  take(count: number): Promise<ServerMessage[]>;
  closed: Promise<{ code: number; reason: string }>;
}

function connect(url: string): Promise<Client> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const queue: ServerMessage[] = [];
    let waiter: (() => void) | null = null;

    socket.on('message', (data) => {
      queue.push(JSON.parse(data.toString()) as ServerMessage);
      waiter?.();
    });
    const closed = new Promise<{ code: number; reason: string }>((done) =>
      socket.on('close', (code, reason) => done({ code, reason: reason.toString() })),
    );

    const take = async (count: number): Promise<ServerMessage[]> => {
      while (queue.length < count) {
        await new Promise<void>((wake) => (waiter = wake));
      }
      return queue.splice(0, count);
    };

    socket.once('open', () => resolve({ socket, take, closed }));
    socket.once('error', reject);
  });
}

describe('WebSocket gateway', () => {
  let app: FastifyInstance | undefined;
  const clients: WebSocket[] = [];

  afterEach(async () => {
    for (const socket of clients.splice(0)) socket.terminate();
    await app?.close();
    app = undefined;
  });

  async function start(env: Record<string, string> = {}): Promise<string> {
    app = await makeApp(env);
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    if (address === null || typeof address === 'string') throw new Error('no port');
    return `ws://127.0.0.1:${address.port}${API.ws}`;
  }

  async function open(url: string): Promise<Client> {
    const client = await connect(url);
    clients.push(client.socket);
    return client;
  }

  const publish = (id: string) =>
    app?.services.bus.publish({
      type: 'menu.category.upserted',
      payload: { id, name: id, sortOrder: 0, version: 1 },
    });

  it('answers hello with welcome, then streams live events', async () => {
    const client = await open(await start({ HEARTBEAT_MS: '60000' }));
    client.socket.send(JSON.stringify({ type: 'hello', lastSeq: null, epoch: null }));

    const [welcome] = await client.take(1);
    expect(welcome).toEqual({ type: 'welcome', serverSeq: 0, heartbeatMs: 60000, epoch: app?.services.epoch });

    publish('a');
    const [event] = await client.take(1);
    expect(event).toMatchObject({ type: 'event', event: { seq: 1, type: 'menu.category.upserted' } });
  });

  it('replays events after lastSeq before live ones', async () => {
    const url = await start();
    for (const id of ['a', 'b', 'c']) publish(id);

    const client = await open(url);
    client.socket.send(JSON.stringify({ type: 'hello', lastSeq: 1, epoch: app?.services.epoch }));
    const replayed = await client.take(3);
    publish('d');
    const messages = [...replayed, ...(await client.take(1))];

    expect(messages[0]).toMatchObject({ type: 'welcome', serverSeq: 3 });
    expect(messages.slice(1).map((message) => message.type === 'event' && message.event.seq)).toEqual([2, 3, 4]);
  });

  it('sends resync_required when lastSeq is no longer buffered', async () => {
    const url = await start({ EVENT_BUFFER_SIZE: '2' });
    for (const id of ['a', 'b', 'c', 'd']) publish(id);

    const client = await open(url);
    client.socket.send(JSON.stringify({ type: 'hello', lastSeq: 0, epoch: app?.services.epoch }));

    const [, resync] = await client.take(2);
    expect(resync).toEqual({ type: 'resync_required', oldestAvailableSeq: 3, serverSeq: 4 });
  });

  it('closes with 4400 when the first frame is not hello', async () => {
    const client = await open(await start());
    client.socket.send('not json');
    expect((await client.closed).code).toBe(WS_CLOSE.PROTOCOL_ERROR);
  });

  it('closes with 4408 when the client stops answering pings', async () => {
    const client = await open(await start({ HEARTBEAT_MS: '30' }));
    client.socket.send(JSON.stringify({ type: 'hello', lastSeq: null, epoch: null }));
    expect((await client.closed).code).toBe(WS_CLOSE.HEARTBEAT_TIMEOUT);
  });

  it('keeps a client that answers pings', async () => {
    const client = await open(await start({ HEARTBEAT_MS: '30' }));
    client.socket.on('message', (data) => {
      const message = JSON.parse(data.toString()) as ServerMessage;
      if (message.type === 'ping') client.socket.send(JSON.stringify({ type: 'pong', ts: message.ts }));
    });
    client.socket.send(JSON.stringify({ type: 'hello', lastSeq: null, epoch: null }));

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(client.socket.readyState).toBe(WebSocket.OPEN);
  });
});
