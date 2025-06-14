import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import manifest from '__STATIC_CONTENT_MANIFEST';

const assetManifest = JSON.parse(manifest);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    console.log(`[${new Date().toISOString()}] Worker received: ${request.method} ${url.pathname}`);

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
      'Access-Control-Max-Age': '86400',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === '/v1/chat/completions') {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;

      if (token !== env.PROXY_API_KEY) {
        return new Response('Unauthorized', { status: 401, headers: corsHeaders });
      }

      const requestBody = await request.json();
      const model = requestBody.model;

      let agent = null;
      for (let i = 1; ; i++) {
        const agentName = env[`DIFY_AGENT${i}_NAME`];
        if (!agentName) break;
        if (agentName === model) {
          agent = {
            url: env[`DIFY_AGENT${i}_URL`],
            key: env[`DIFY_AGENT${i}_KEY`],
          };
          break;
        }
      }

      if (!agent) {
        return new Response(JSON.stringify({ error: `Model '${model}' not found.` }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const lastMessage = requestBody.messages[requestBody.messages.length - 1];

      const difyPayload = {
        query: lastMessage.content,
        user: requestBody.user || 'dify-proxy-user',
        response_mode: 'streaming',
        inputs: {},
      };

      const difyRequest = new Request(`${agent.url}/chat-messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${agent.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(difyPayload),
      });

      const difyResponse = await fetch(difyRequest);

      if (!difyResponse.ok) {
        const errorBody = await difyResponse.text();
        console.error(`Dify API Error: ${difyResponse.status} ${difyResponse.statusText}`, errorBody);
        return new Response(errorBody, { status: difyResponse.status, headers: corsHeaders });
      }

      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const reader = difyResponse.body.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();

      const processStream = async () => {
        let buffer = '';
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              writer.close();
              break;
            }
            
            buffer += decoder.decode(value, { stream: true });
            let eolIndex;

            while ((eolIndex = buffer.indexOf('\n\n')) >= 0) {
              const message = buffer.slice(0, eolIndex);
              buffer = buffer.slice(eolIndex + 2);

              if (message.startsWith('data:')) {
                const dataStr = message.substring(5).trim();
                if (dataStr === '[DONE]') {
                  writer.write(encoder.encode('data: [DONE]\n\n'));
                  continue;
                }
                try {
                  const difyJson = JSON.parse(dataStr);
                  const openAIChunk = {
                    id: difyJson.conversation_id || `chatcmpl-${Date.now()}`,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: requestBody.model,
                    choices: [{
                      index: 0,
                      delta: { content: difyJson.answer },
                      finish_reason: difyJson.event === 'message_end' ? 'stop' : null,
                    }],
                  };
                  writer.write(encoder.encode(`data: ${JSON.stringify(openAIChunk)}\n\n`));
                } catch (e) {
                  console.error('Error parsing Dify JSON chunk:', dataStr, e);
                }
              }
            }
          }
        } catch (e) {
          console.error('Error processing stream:', e);
          writer.close();
        }
      };

      processStream();

      return new Response(readable, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream; charset=utf-8' },
      });
    }

    try {
      const page = await getAssetFromKV(
        {
          request,
          waitUntil: ctx.waitUntil.bind(ctx),
        },
        {
          ASSET_NAMESPACE: env.__STATIC_CONTENT,
          ASSET_MANIFEST: assetManifest,
        }
      );

      const response = new Response(page.body, page);
      Object.keys(corsHeaders).forEach(header => {
        response.headers.set(header, corsHeaders[header]);
      });
      return response;
    } catch (e) {
      return new Response(`Not Found: ${url.pathname}`, { status: 404, headers: corsHeaders });
    }
  },
};
