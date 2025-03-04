import fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Static, Type } from '@sinclair/typebox';
import { FastifyPluginCallback } from 'fastify';

const HelloWorld = Type.String({
  description: 'The magical words!'
});

export interface HealthcheckOptions {
  title: string;
}

const healthcheck: FastifyPluginCallback<HealthcheckOptions> = (
  fastify,
  opts,
  next
) => {
  fastify.get<{ Reply: Static<typeof HelloWorld> }>(
    '/',
    {
      schema: {
        description: 'Say hello',
        response: {
          200: HelloWorld
        }
      }
    },
    async (_, reply) => {
      reply.send('Hello, world! I am ' + opts.title);
    }
  );
  next();
};

export interface ApiTokenOptions {
  openAiApiKey: string;
}
const OpenAiResponse = Type.Object({
  client_secret: Type.Object({
    value: Type.String(),
    expires_at: Type.Number()
  })
});

const apiToken: FastifyPluginCallback<ApiTokenOptions> = (
  fastify,
  opts,
  next
) => {
  fastify.get<{ Reply: Static<typeof OpenAiResponse> | { message: string } }>(
    '/session',
    {
      schema: {
        description: 'Create a new ephmeral token',
        response: {
          200: OpenAiResponse,
          500: Type.Object({ message: Type.String() })
        }
      }
    },
    async (_, reply) => {
      try {
        const response = await fetch(
          'https://api.openai.com/v1/realtime/sessions',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${opts.openAiApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'gpt-4o-realtime-preview-2024-12-17',
              voice: 'verse'
            })
          }
        );
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const json = await response.json();
        reply.send(json);
      } catch (error) {
        reply.code(500).send({ message: (error as Error).message });
      }
    }
  );

  next();
};

export interface ApiOptions {
  title: string;
  openAiApiKey: string;
}

export default (opts: ApiOptions) => {
  const api = fastify({
    ignoreTrailingSlash: true
  }).withTypeProvider<TypeBoxTypeProvider>();

  // register the cors plugin, configure it for better security
  api.register(cors);

  // register the swagger plugins, it will automagically do magic
  api.register(swagger, {
    swagger: {
      info: {
        title: opts.title,
        description: 'hello',
        version: 'v1'
      }
    }
  });
  api.register(swaggerUI, {
    routePrefix: '/docs'
  });

  api.register(healthcheck, { title: opts.title });
  // register other API routes here
  api.register(apiToken, { openAiApiKey: opts.openAiApiKey });

  return api;
};
