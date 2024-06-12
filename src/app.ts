import "dotenv/config";
import { createBot, createProvider, createFlow, addKeyword, EVENTS } from '@builderbot/bot';
import { MemoryDB as Database } from '@builderbot/bot';
import { BaileysProvider as Provider } from '@builderbot/provider-baileys';
import { toAsk, httpInject } from "@builderbot-plugins/openai-assistants";
import { typing } from "./utils/presence";
import cron from 'node-cron';

const PORT = process.env?.PORT ?? 3008;
const ASSISTANT_ID = process.env?.ASSISTANT_ID ?? '';
const BACKEND_URL = process.env?.BACKEND_URL || 'provide_backend_api_endpoint_that_is_provided_by_rendor';

const welcomeFlow = addKeyword<Provider, Database>(EVENTS.WELCOME)
    .addAction(async (ctx, { flowDynamic, state, provider }) => {
        await typing(ctx, provider);
        const response = await toAsk(ASSISTANT_ID, ctx.body, state);
        const chunks = response.split(/\n\n+/);
        for (const chunk of chunks) {
            await flowDynamic([{ body: chunk.trim() }]);
        }
    });

// Cron job to hit endpoint every 14 minutes to keep backend alive
const job = cron.schedule('*/14 * * * *', async () => {
    console.log('Restarting server');

    try {
        const res = await fetch(BACKEND_URL);
        if (res.ok) {
            console.log('Server restarted');
        } else {
            console.error(`Failed to restart server with status code: ${res.status}`);
        }
    } catch (err) {
        console.error('Error during Restart:', err);
    }
});

const main = async () => {
    const adapterFlow = createFlow([welcomeFlow]);
    const adapterProvider = createProvider(Provider);
    const adapterDB = new Database();

    const { httpServer } = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    });

    httpInject(adapterProvider.server);
    httpServer(+PORT);
};

main();