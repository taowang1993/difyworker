const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Difyworker</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        theme: {
          extend: {
            colors: {
              primary: '#2563eb',
              secondary: '#1e40af',
              neon: '#00f6ff',
            },
            animation: {
              gradient: 'gradient 8s linear infinite',
            },
            keyframes: {
              gradient: {
                '0%, 100%': {
                  'background-size': '200% 200%',
                  'background-position': 'left center',
                },
                '50%': {
                  'background-size': '200% 200%',
                  'background-position': 'right center',
                },
              },
            },
          },
        },
      };
    </script>
  </head>
  <body
    class="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-gray-100 font-sans min-h-screen flex flex-col"
  >
    <header class="py-16 animate-gradient backdrop-blur-lg">
      <div class="container mx-auto px-4 sm:px-6 lg:px-8">
        <h1
          class="text-5xl font-bold mb-4 text-center bg-clip-text text-transparent bg-gradient-to-r from-white to-neon leading-relaxed"
        >
          Difyworker
        </h1>
        <div class="text-xl md:text-2xl text-center space-y-2">
          <div class="text-blue-200">Convert Dify API to OpenAI API</div>
          <div class="text-blue-200">Connect multiple Dify agents through a single endpoint</div>
        </div>
      </div>
    </header>

    <main class="flex-grow flex flex-col backdrop-blur-sm">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 flex-grow flex flex-col justify-between">
        <div class="space-y-8">
          <div
            class="bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-8 rounded-3xl shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-slate-700/30 backdrop-blur-xl hover:border-neon/30"
          >
            <h2
              class="text-3xl font-bold mb-6 text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-neon"
            >
              About
            </h2>
            <p class="mb-4 text-slate-300">
              Difyworker is a powerful API converter that transforms the Dify API format into OpenAI API format, allowing
              you to use Dify's LLMs, knowledge base, tools, and workflows within your preferred OpenAI clients.
            </p>
            <p class="mb-4 text-slate-300">
              The proxy supports multiple Dify agents through a single endpoint, making it easy to switch between
              different agents using just the <span class="text-neon font-mono">model</span> parameter in your API
              requests.
            </p>
          </div>

          <div
            class="bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-8 rounded-3xl shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-slate-700/30 backdrop-blur-xl hover:border-neon/30"
          >
            <h2
              class="text-3xl font-bold mb-6 text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-neon"
            >
              Author
            </h2>
            <h4 class="text-lg font-medium mb-4 text-center text-slate-300">Tao Wang</h4>
            <div class="text-center space-y-2">
              <a
                href="https://github.com/taowang1993"
                target="_blank"
                class="block text-neon hover:text-blue-400 transition-colors duration-200"
                >https://github.com/taowang1993</a
              >
            </div>
          </div>
        </div>

        <div class="py-5">
          <!-- Empty div to add space at the bottom of the page -->
        </div>
      </div>
    </main>
  </body>
</html>`;

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

    if (url.pathname === '/') {
        return new Response(indexHtml, {
            headers: {
                'Content-Type': 'text/html;charset=UTF-8',
                ...corsHeaders
            }
        });
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

      if (agent && agent.url.startsWith('http://')) {
        agent.url = agent.url.replace('http://', 'https://');
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

            const chatMessagesUrl = agent.url.endsWith('/') ? `${agent.url}chat-messages` : `${agent.url}/chat-messages`;
      const difyRequest = new Request(chatMessagesUrl, {
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

    return new Response(`Not Found: ${url.pathname}`, { status: 404, headers: corsHeaders });
  },
};
