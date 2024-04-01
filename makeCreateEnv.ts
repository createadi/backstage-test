import Router from 'express-promise-router';
import {
  CacheManager,
  DatabaseManager,
  getRootLogger,
  HostDiscovery,
  ServerTokenManager,
  UrlReaders,
} from '@backstage/backend-common';
import { TaskScheduler } from '@backstage/backend-tasks';
import { Config } from '@backstage/config';
import { PluginEnvironment } from './types';
import { ServerPermissionClient } from '@backstage/plugin-permission-node';
import { DefaultIdentityClient } from '@backstage/plugin-auth-node';
import { DefaultEventBroker } from '@backstage/plugin-events-backend';
import { DefaultEventsService } from '@backstage/plugin-events-node';
import { DefaultSignalsService } from '@backstage/plugin-signals-node';

export function makeCreateEnv(config: Config) {
  const root = getRootLogger();
  const reader = UrlReaders.default({ logger: root, config });
  const discovery = HostDiscovery.fromConfig(config);
  const tokenManager = ServerTokenManager.fromConfig(config, { logger: root });
  const permissions = ServerPermissionClient.fromConfig(config, {
    discovery,
    tokenManager,
  });
  const databaseManager = DatabaseManager.fromConfig(config, { logger: root });
  const cacheManager = CacheManager.fromConfig(config);
  const taskScheduler = TaskScheduler.fromConfig(config, { databaseManager });
  const identity = DefaultIdentityClient.create({
    discovery,
  });

  const eventsService = DefaultEventsService.create({ logger: root });
  const eventBroker = new DefaultEventBroker(
    root.child({ type: 'plugin' }),
    eventsService,
  );
  const signalsService = DefaultSignalsService.create({
    events: eventsService,
  });

  root.info(`Created UrlReader ${reader}`);

  return (plugin: string): PluginEnvironment => {
    const logger = root.child({ type: 'plugin', plugin });
    const database = databaseManager.forPlugin(plugin);
    const cache = cacheManager.forPlugin(plugin);
    const scheduler = taskScheduler.forPlugin(plugin);

    return {
      logger,
      cache,
      database,
      config,
      reader,
      eventBroker,
      events: eventsService,
      discovery,
      tokenManager,
      permissions,
      scheduler,
      identity,
      signals: signalsService,
    };
  };
}
