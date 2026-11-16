import { Agent, setGlobalDispatcher } from 'undici';

export function configureUndiciAgent(): Agent {
  const agent = new Agent({
    keepAliveTimeout: 60000,
    keepAliveMaxTimeout: 600000,
    pipelining: 1,
    connections: 128,
  });

  setGlobalDispatcher(agent);
  return agent;
}
