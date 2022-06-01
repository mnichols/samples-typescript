import { InjectedSinks, NativeConnection, Worker, WorkerOptions } from '@temporalio/worker';
import * as fs from 'fs';
import { createActivities } from './activities';
import { createClients } from './clients';
import { Env, getEnv, isRemoteEnv } from './env';
import { LoggerSinks } from './workflows';

// worker
async function run(env: Env) {
  const sinks: InjectedSinks<LoggerSinks> = {
    logger: {
      info: {
        fn(workflowInfo, message) {
          console.log('workflow: ', workflowInfo.runId, 'message: ', message);
        },
        callDuringReplay: false, // The default
      },
      err: {
        fn(workflowInfo, message) {
          console.error('workflow: ', workflowInfo.runId, 'message: ', message);
        },
        callDuringReplay: false, // The default
      },
    },
  };

  // registrations
  const singletonClients = await createClients();
  const activities = createActivities(singletonClients) as any;

  const opts: WorkerOptions = {
    workflowsPath: require.resolve('./workflows'),
    activities,
    taskQueue: env.taskQueue,
    sinks,
  };

  if (isRemoteEnv(env)) {
    const { address, namespace, clientCertPath, clientKeyPath } = env;
    const crtBytes = fs.readFileSync(clientCertPath);
    const keyBytes = fs.readFileSync(clientKeyPath);

    opts.connection = await NativeConnection.create({
      address,
      tls: {
        // See docs for other TLS options
        clientCertPair: {
          crt: crtBytes,
          key: keyBytes,
        },
      },
    });
    opts.namespace = namespace;
  }
  const worker = await Worker.create(opts);

  await worker.run();
}

run(getEnv()).catch((err) => {
  console.error(err);
  process.exit(1);
});
