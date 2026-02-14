# Azure AI Foundry: JavaScript Demo of Code Interpreter Agentic Tool (Agents v2)

This repo demonstrates the use of **Azure AI Foundry Projects SDK** with the **Code Interpreter** tool and **Agents v2 API** in JavaScript.

> [!TIP]
> For classic agents using `@azure/ai-agents`, check this repo instead: [AIFoundry-Agents-CodeInterpreter-JavaScript](https://github.com/LazaUK/AIFoundry-Agents-CodeInterpreter-JavaScript).

## 📑 Table of Contents:
- [Part 1: Configuring Solution Environment](#part-1-configuring-solution-environment)
- [Part 2: Client Initialisation](#part-2-client-initialisation)
- [Part 3: Code Interpreter Tool](#part-3-code-interpreter-tool)
- [Part 4: Running the Demo](#part-4-running-the-demo)
- [Appendix: Agents v1 (Classic) vs v2 (New) Comparison]()

## Part 1: Configuring Solution Environment
To run the provided JavaScript demo, you'll need to set up your Azure AI Foundry project and install required packages.

### 1.1 Azure AI Foundry Setup
Ensure you have an Azure AI Foundry **project** with a deployed model (e.g., **gpt-4.1-mini**).

> [!IMPORTANT]
> The code requires an **Azure AI Foundry Project endpoint**, not a standard _Azure OpenAI endpoint_. These are different services with different endpoint formats.

| Service          | Endpoint Format                                                      |
| ---------------- | -------------------------------------------------------------------- |
| Azure OpenAI     | `https://<resource>.openai.azure.com/openai/v1/`                     |
| Azure AI Foundry | `https://<resource>.services.ai.azure.com/api/projects/<project-id>` |

### 1.2 Authentication
The demo utilises **Microsoft Entra ID** (former Azure AD) for secure authentication via the `DefaultAzureCredential` from the `@azure/identity` package.

Before running the demo, ensure you are logged in with the following Az CLI command:

``` PowerShell
az login
```

### 1.3 Environment Variables
Configure the following environment variables:

| Environment Variable           | Description                                                                                                          |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| AZURE_FOUNDRY_PROJECT_ENDPOINT | Your Azure AI Foundry Project endpoint (e.g., `https://<resource>.services.ai.azure.com/api/projects/<project-id>`). |
| AZURE_FOUNDRY_GPT_MODEL        | The name of your model deployment (e.g., `gpt-4.1-mini`).                                                            |

### 1.4 Installation
Install required JS libraries:

``` Bash
npm install @azure/ai-projects@beta @azure/identity openai
```

### 1.5 Data File
Ensure you have a `sales_data.csv` file in the same directory as the script. The file should contain the following columns:

``` CSV
Month,Sales,Expenses,Profit
Jan,10000,6500,3500
Feb,12000,7800,4200
...
```

A sample `sales_data.csv` is included in this repo.

## Part 2: Client Initialisation
The demo uses the `@azure/ai-projects` SDK (v2 beta) to interact with Azure AI Foundry's Agents API:

- **AIProjectClient**: The main client for interacting with your Foundry project.
- **OpenAI Client**: Obtained via `project.getOpenAIClient()` for Responses API calls.
- **DefaultAzureCredential**: Provides authentication via Microsoft Entra ID.

``` JavaScript
const { AIProjectClient } = require("@azure/ai-projects");
const { DefaultAzureCredential } = require("@azure/identity");

// Initialize Azure AI Projects client
const credential = new DefaultAzureCredential();
const project = new AIProjectClient(process.env.AZURE_FOUNDRY_PROJECT_ENDPOINT, credential);

// Get OpenAI client for Responses API
const openAIClient = await project.getOpenAIClient();
```

## Part 3: Code Interpreter Tool
The **Code Interpreter** tool allows your AI agent to write and execute Python code in a sandboxed environment.

### 3.1 Creating a Registered Agent with Code Interpreter
Create a versioned agent with the Code Interpreter tool attached.

``` JavaScript
const agent = await project.agents.createVersion("DataAnalystAgent", {
  kind: "prompt",
  model: process.env.AZURE_FOUNDRY_GPT_MODEL,
  instructions: "You are a helpful data analyst assistant...",
  tools: [
    { type: "code_interpreter" }
  ],
});
console.log(`Agent created (ID: ${agent.id}, Name: ${agent.name}, Version: ${agent.version})`);
```

### 3.2 Creating a Conversation Thread
Create a conversation to maintain context across interactions.

``` JavaScript
const conversation = await openAIClient.conversations.create();
console.log(`Conversation created (ID: ${conversation.id})`);
```

### 3.3 Running the Agent
Invoke the registered agent using `agent_reference` in the Responses API call.

``` JavaScript
// Run the agent using agent_reference - this invokes the actual registered agent!
const response = await openAIClient.responses.create(
  {
    conversation: conversation.id,
    input: "Analyze the sales data...",
  },
  {
    body: { 
      agent: { 
        name: agent.name, 
        type: "agent_reference" 
      } 
    },
  }
);

console.log(response.output_text);
```

### 3.4 Cleanup Resources
Delete the conversation and agent when done.

``` JavaScript
// Delete conversation
await openAIClient.conversations.delete(conversation.id);

// Delete agent
await project.agents.deleteVersion(agent.name, agent.version);
```

## Part 4: Running the Demo

### 4.1 Execute the Demo
Run the demo script from your terminal after ensuring your environment variables are configured.

``` PowerShell
node demo-code-interpreter-v2.js
```

### 4.2 Expected Output
If setup successfully, you should get a response looking like this:

``` JSON
============================================================
AZURE AI FOUNDRY - Code Interpreter Demo v2 (JavaScript)
Using Registered Agent with Code Interpreter Tool
============================================================

Endpoint: https://XXXXXXXXXXXXX.services.ai.azure.com/api/projects/YYYYYYYYYYYYYY
Model Deployment: gpt-4.1-mini

✓ Found data file: ./sales_data.csv

Initialising Azure AI Projects client...
✓ Client initialised.

Getting OpenAI client...
✓ OpenAI client ready.

Creating registered AI Agent with Code Interpreter...
✓ Agent created!
  Agent ID: /agents/DataAnalystAgent/versions/1
  Agent Name: DataAnalystAgent
  Agent Version: 1

Creating conversation thread...
✓ Conversation created (ID: conv_ZZZZZZZZZZZZZZZ)

────────────────────────────────────────────────────────────
USER MESSAGE:
────────────────────────────────────────────────────────────
Analyzing sales_data.csv with Code Interpreter...
────────────────────────────────────────────────────────────

Running registered Agent via Responses API...

AGENT RESPONSE:
────────────────────────────────────────────────────────────
Here are the results from the sales_data analysis:

1. Total annual sales: 186,500
2. Total annual expenses: 119,100
3. Total annual profit: 67,400
4. The month with the highest profit: December (Dec)
5. Average monthly profit margin: approximately 36.07%

Summary of the business performance:
The business generated total sales of 186,500 over the year, with expenses 
totaling 119,100, resulting in a healthy profit of 67,400. December was the 
most profitable month. The average profit margin of about 36% indicates good 
profitability, suggesting efficient cost management relative to sales. 
Overall, the performance appears strong with consistent profitability.
────────────────────────────────────────────────────────────

RESPONSE ANALYSIS (Proof of Code Interpreter):
────────────────────────────────────────────────────────────
Output type: code_interpreter_call

✓ CODE INTERPRETER WAS USED!
  Container ID: cntr_ZZZZZZZZZZZZZZZ
  Code Interpreter ID: ci_ZZZZZZZZZZZZZZZ

  Python Code Executed:
  ──────────────────────────────────────────────────
  import pandas as pd
  from io import StringIO
  ...
  ──────────────────────────────────────────────────

✓ Analysis completed!
────────────────────────────────────────────────────────────

Cleaning up resources...
✓ Conversation deleted.
✓ Agent deleted (DataAnalystAgent v1).
```

## Appendix: Agents v1 (Classic) vs v2 (New) Comparison

| Aspect               | v1 (Classic)                              | v2 (This Repo)                              |
|----------------------|-------------------------------------------|---------------------------------------------|
| **Package**          | `@azure/ai-agents`                        | `@azure/ai-projects@beta`                   |
| **API Pattern**      | Thread → Message → Run → Poll             | Conversation + Responses API                |
| **Agent Creation**   | `client.createAgent()`                    | `project.agents.createVersion()`            |
| **Agent Invocation** | `client.runs.createAndPoll()`             | `responses.create()` with `agent_reference` |
| **Code Interpreter** | `ToolUtility.createCodeInterpreterTool()` | `{ type: "code_interpreter" }`              |
