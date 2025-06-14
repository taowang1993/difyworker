## About
Difyworker converts Dify API to OpenAI API.


## Features
- Support streaming and blocking
- Support Chat, Completion, Agent and Workflow bots API on Dify
- Support multiple Dify agents through a single endpoint using the `model` parameter


## Usage

```JavaScript
const response = await fetch('http://localhost:3000/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your_proxy_api_key',  // Use your configured PROXY_API_KEY here
  },
  body: JSON.stringify({
    model: 'AgentName1',  // Specify which agent to use by name
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello, how are you?' },
    ],
    stream: false  // Set to true for streaming responses
  }),
});

const data = await response.json();
console.log(data);
```

## Configuration

1. Copy the example configuration file and update it with your values:
   ```bash
   cp wrangler.example.toml wrangler.toml
   ```

2. Edit `wrangler.toml` and fill in your actual configuration values.

## Deployment

```bash
wrangler login
npm install
npm run deploy
```

| Environment Variable | Required | Description                                                                                                                                                               | Example                                                                                                              |
| -------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `PORT`              | No       | Port on which the server will listen                                                                                                                           | `3000`                                                                                                               |
| `PROXY_API_KEY`     | Yes      | API key for client authentication with Difyworker                                                                                                                  | `your_proxy_api_key`                                                                                                 |
| `DIFY_AGENT1_NAME`     | Yes      | Name of the first agent (used as the model parameter)                                                                                                                  | `agent1`                                                                                                 |
| `DIFY_AGENT1_TYPE`     | Yes      | Type of the first agent                                                                                                                  | `Chat,Completion,Workflow`                                                                                                 |
| `DIFY_AGENT1_URL`     | Yes      | API URL for the first agent                                                                                                                  | `http://api.dify.ai/v1`                                                                                                 |
| `DIFY_AGENT1_KEY`     | Yes      | API key for the first agent                                                                                                                  | `your_dify_api_key_1`                                                                                                  |
| `DIFY_AGENT1_INPUT_VARIABLE`     | No      | Input variable for the first agent                                                                                                                  | `query,text`                                                                                                 |
| `DIFY_AGENT1_OUTPUT_VARIABLE`     | No      | Output variable for the first agent                                                                                                                  | `text`                                                                                                 |

You can configure any number of agents by following the same pattern with incrementing numbers (e.g., `DIFY_AGENT1_*`, `DIFY_AGENT2_*`, `DIFY_AGENT3_*`, etc.). There is no upper limit on the number of agents you can configure.


## License
This project is licensed under the MIT License.
