import Router from 'express-promise-router';
import {
  createServiceBuilder,
  getRootLogger,
  loadBackendConfig,
  notFoundHandler,
  useHotMemoize,
} from '@backstage/backend-common';
import healthcheck from './plugins/healthcheck';
import app from './plugins/app';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { MeterProvider } from '@opentelemetry/sdk-metrics';
import { metrics } from '@opentelemetry/api';
import { makeCreateEnv } from './makeCreateEnv';
import myAwesomePlugin from './plugins/myawesomeplugin';

// Expose opentelemetry metrics using a Prometheus exporter on
// http://localhost:9464/metrics . See prometheus.yml in packages/backend for
// more information on how to scrape it.
const exporter = new PrometheusExporter();
const meterProvider = new MeterProvider();
metrics.setGlobalMeterProvider(meterProvider);
meterProvider.addMetricReader(exporter);

async function main() {
  // metricsInit();
  const logger = getRootLogger();

  logger.info(
    `You are running an example backend, which is supposed to be mainly used for contributing back to Backstage. ` +
      `Do NOT deploy this to production. Read more here https://backstage.io/docs/getting-started/`,
  );

  const config = await loadBackendConfig({
    argv: process.argv,
    logger: getRootLogger(),
    // logger,
  });

  const createEnv = makeCreateEnv(config);

  const healthcheckEnv = useHotMemoize(module, () => createEnv('healthcheck'));
  const appEnv = useHotMemoize(module, () => createEnv('app'));
  const myAwesomePluginEnv = useHotMemoize(module, () =>
    createEnv('my-awesome-plugin'),
  );

  const apiRouter = Router();
  apiRouter.use(
    '/my-awesome-plugin',
    await myAwesomePlugin(myAwesomePluginEnv),
  );
  apiRouter.use(notFoundHandler());

  const service = createServiceBuilder(module)
    .loadConfig(config)
    .addRouter('', await healthcheck(healthcheckEnv))
    .addRouter('/api', apiRouter)
    .addRouter('', await app(appEnv));

  await service.start().catch(err => {
    logger.error(err);
    process.exit(1);
  });
}

module.hot?.accept();
main().catch(error => {
  console.error('Backend failed to start up', error);
  process.exit(1);
});
