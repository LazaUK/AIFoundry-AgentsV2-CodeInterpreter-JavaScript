// ============================================
// Azure AI Foundry - Agents API v2 Demo
// Code Interpreter Tool Example (JavaScript)
// ============================================
// This demo shows how to use the NEW Azure AI Projects SDK (v2)
// with a 'prompt'-type AI agent and Code Interpreter tool.
//
// Prerequisites:
//   1. Node.js installed (version 18 or higher)
//   2. An Azure AI Foundry project with a deployed model
//   3. Azure CLI installed and logged in (az login)
//
// Installation:
//   npm install @azure/ai-projects@beta @azure/identity openai
//
// Environment Variables (set in Windows before running):
//   AZURE_FOUNDRY_PROJECT_ENDPOINT - Your Azure AI Foundry Project endpoint
//   AZURE_FOUNDRY_GPT_MODEL        - Your model deployment name (e.g., gpt-4.1-mini)
//
// Run:
//   node demo-code-interpreter-v2.js
// ============================================

const { AIProjectClient } = require("@azure/ai-projects");
const { DefaultAzureCredential } = require("@azure/identity");
const fs = require("node:fs");

// Configuration from Windows environment variables
const AZURE_FOUNDRY_PROJECT_ENDPOINT = process.env.AZURE_FOUNDRY_PROJECT_ENDPOINT;
const AZURE_FOUNDRY_GPT_MODEL = process.env.AZURE_FOUNDRY_GPT_MODEL;

// Validate environment variables
if (!AZURE_FOUNDRY_PROJECT_ENDPOINT || !AZURE_FOUNDRY_GPT_MODEL) {
  console.error("Error: Environment variables not set properly!");
  console.error("Please set AZURE_FOUNDRY_PROJECT_ENDPOINT and AZURE_FOUNDRY_GPT_MODEL");
  process.exit(1);
}

async function main() {
  console.log("=".repeat(60));
  console.log("AZURE AI FOUNDRY - Code Interpreter Demo v2 (JavaScript)");
  console.log("Using Registered Agent with Code Interpreter Tool");
  console.log("=".repeat(60));
  console.log(`\nEndpoint: ${AZURE_FOUNDRY_PROJECT_ENDPOINT}`);
  console.log(`Model Deployment: ${AZURE_FOUNDRY_GPT_MODEL}\n`);

  let agent = null;
  let project = null;
  let openAIClient = null;
  let conversation = null;

  try {
    // ─────────────────────────────────────────────────────────────
    // Step 1: Check for the CSV file
    // ─────────────────────────────────────────────────────────────
    const csvFilePath = "./sales_data.csv";
    
    if (!fs.existsSync(csvFilePath)) {
      console.error(`Error: File not found: ${csvFilePath}`);
      console.error("Please ensure sales_data.csv exists in the current directory.");
      process.exit(1);
    }
    console.log(`✓ Found data file: ${csvFilePath}\n`);

    // Read the CSV content to include in the prompt
    const csvContent = fs.readFileSync(csvFilePath, "utf-8");

    // ─────────────────────────────────────────────────────────────
    // Step 2: Initialise Azure AI Projects client
    // ─────────────────────────────────────────────────────────────
    console.log("Initialising Azure AI Projects client...");
    const credential = new DefaultAzureCredential();
    project = new AIProjectClient(AZURE_FOUNDRY_PROJECT_ENDPOINT, credential);
    console.log("✓ Client initialised.\n");

    // ─────────────────────────────────────────────────────────────
    // Step 3: Get OpenAI client from the project
    // ─────────────────────────────────────────────────────────────
    console.log("Getting OpenAI client...");
    openAIClient = await project.getOpenAIClient();
    console.log("✓ OpenAI client ready.\n");

    // ─────────────────────────────────────────────────────────────
    // Step 4: Create an AI Agent with Code Interpreter
    // ─────────────────────────────────────────────────────────────
    console.log("Creating registered AI Agent with Code Interpreter...");
    agent = await project.agents.createVersion("DataAnalystAgent", {
      kind: "prompt",
      model: AZURE_FOUNDRY_GPT_MODEL,
      instructions: `You are a helpful data analyst assistant. 
Use the Code Interpreter tool to execute Python code for data analysis.
Always explain your analysis clearly and provide insights from the data.`,
      tools: [
        { 
          type: "code_interpreter"
        }
      ],
    });
    console.log(` - Agent ID: ${agent.id}`);
    console.log(` - Agent Name: ${agent.name}`);
    console.log(` - Agent Version: ${agent.version}\n`);

    // ─────────────────────────────────────────────────────────────
    // Step 5: Create a conversation thread
    // ─────────────────────────────────────────────────────────────
    console.log("Creating conversation thread...");
    conversation = await openAIClient.conversations.create();
    console.log(`✓ Conversation created (ID: ${conversation.id})\n`);

    // ─────────────────────────────────────────────────────────────
    // Step 6: Prepare the user prompt
    // ─────────────────────────────────────────────────────────────
    const userPrompt = `Here is a CSV file with sales data:

\`\`\`csv
${csvContent}
\`\`\`

Please analyze this data and:
1. Calculate the total annual sales, expenses, and profit
2. Identify the month with the highest profit
3. Calculate the average monthly profit margin (profit/sales * 100)
4. Provide a brief summary of the business performance

Use Python code to perform these calculations.`;

    console.log("─".repeat(60));
    console.log("USER MESSAGE:");
    console.log("─".repeat(60));
    console.log("Analyzing sales_data.csv with Code Interpreter...");
    console.log("─".repeat(60) + "\n");

    // ─────────────────────────────────────────────────────────────
    // Step 7: Run the registered Agent using agent_reference
    // ─────────────────────────────────────────────────────────────
    console.log("Running registered Agent via Responses API...\n");

    const response = await openAIClient.responses.create(
      {
        conversation: conversation.id,
        input: userPrompt,
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

    // ─────────────────────────────────────────────────────────────
    // Step 8: Display the response
    // ─────────────────────────────────────────────────────────────
    console.log("AGENT RESPONSE:");
    console.log("─".repeat(60));
    console.log(response.output_text);
    console.log("─".repeat(60));

    // ─────────────────────────────────────────────────────────────
    // Step 9: Verify Code Interpreter was actually used
    // ─────────────────────────────────────────────────────────────
    console.log("\nRESPONSE ANALYSIS (Proof of Code Interpreter):");
    console.log("─".repeat(60));
    
    if (response.output && Array.isArray(response.output)) {
      let codeInterpreterUsed = false;
      
      for (const item of response.output) {
        console.log(`Output type: ${item.type}`);
        
        if (item.type === "code_interpreter_call") {
          codeInterpreterUsed = true;
          console.log("\n✓ CODE INTERPRETER WAS USED!");
          console.log(`  Container ID: ${item.container_id || "N/A"}`);
          console.log(`  Code Interpreter ID: ${item.id || "N/A"}`);
          
          if (item.code) {
            console.log("\n  Python Code Executed:");
            console.log("  " + "─".repeat(50));
            console.log(item.code.split('\n').map(line => "  " + line).join('\n'));
            console.log("  " + "─".repeat(50));
          }
        }
      }
      
      if (!codeInterpreterUsed) {
        console.log("\nNo code_interpreter_call found in output.");
      }
    }
    
    console.log("\nFull Response Structure:");
    console.log(` - Response ID: ${response.id}`);
    console.log(` - Model: ${response.model}`);
    console.log(` - Output items: ${response.output?.length || 0}`);
    
    if (response.usage) {
      console.log(` - Input tokens: ${response.usage.input_tokens}`);
      console.log(` - Output tokens: ${response.usage.output_tokens}`);
    }

    console.log("\n✓ Analysis completed!");
    console.log("─".repeat(60));

  } catch (error) {
    console.error("\nError occurred:", error.message);
    
    if (error.message.includes("DefaultAzureCredential")) {
      console.log("\nTip: Make sure you're logged in with 'az login'");
    }
    if (error.message.includes("404") || error.message.includes("not found")) {
      console.log("\nTip: Check that your AZURE_FOUNDRY_PROJECT_ENDPOINT is correct");
    }
    if (error.message.includes("createVersion")) {
      console.log("\nTip: Agent creation failed. Check your model deployment name.");
    }

  } finally {
    // ─────────────────────────────────────────────────────────────
    // Cleanup: Delete conversation and agent
    // ─────────────────────────────────────────────────────────────
    console.log("\nCleaning up resources...");
    
    if (conversation && openAIClient) {
      try {
        await openAIClient.conversations.delete(conversation.id);
        console.log("✓ Conversation deleted.");
      } catch (cleanupError) {
        console.log("Note: Could not delete conversation:", cleanupError.message);
      }
    }
    
    if (agent && project) {
      try {
        await project.agents.deleteVersion(agent.name, agent.version);
        console.log(`✓ Agent deleted (${agent.name} v${agent.version}).`);
      } catch (cleanupError) {
        console.log("Note: Could not delete agent:", cleanupError.message);
      }
    }
  }
}

// Run the demo
main().catch(console.error);
