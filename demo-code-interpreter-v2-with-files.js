// =============================================================
// AZURE AI FOUNDRY - Code Interpreter Demo v2 with File Upload
// Uploads a CSV to Foundry, passes its ID to Code Interpreter,
// runs the agent, and downloads any generated output files.
// =============================================================

"use strict";

const { AIProjectClient } = require("@azure/ai-projects");
const { DefaultAzureCredential } = require("@azure/identity");
const fs = require("fs");
const path = require("path");

// ── Environment variables ──────────────────────────────────────
const PROJECT_ENDPOINT = process.env.AZURE_FOUNDRY_PROJECT_ENDPOINT;
const MODEL_DEPLOYMENT  = process.env.AZURE_FOUNDRY_GPT_MODEL;

if (!PROJECT_ENDPOINT || !MODEL_DEPLOYMENT) {
  console.error("ERROR: Set AZURE_FOUNDRY_PROJECT_ENDPOINT and AZURE_FOUNDRY_GPT_MODEL.");
  process.exit(1);
}

// ── Input file ─────────────────────────────────────────────────
const DATA_FILE_PATH = path.resolve("./sales_data.csv");
const DOWNLOADS_DIR  = "./downloads";

// ── Main ───────────────────────────────────────────────────────
async function main() {
  console.log("=".repeat(60));
  console.log("AZURE AI FOUNDRY - Code Interpreter Demo v2 (with Files)");
  console.log("=".repeat(60));
  console.log(`Endpoint : ${PROJECT_ENDPOINT}`);
  console.log(`Model    : ${MODEL_DEPLOYMENT}\n`);

  // 1. Verify the local data file exists
  if (!fs.existsSync(DATA_FILE_PATH)) {
    console.error(`ERROR: Data file not found at ${DATA_FILE_PATH}`);
    process.exit(1);
  }
  console.log(`✓ Found data file: ${DATA_FILE_PATH}\n`);

  // 2. Initialise the AI Projects client and get an OpenAI sub-client
  console.log("Initialising Azure AI Projects client...");
  const credential = new DefaultAzureCredential();
  const project    = new AIProjectClient(PROJECT_ENDPOINT, credential);
  console.log("✓ Client initialised.\n");

  console.log("Getting OpenAI client...");
  const openAIClient = await project.getOpenAIClient();
  console.log("✓ OpenAI client ready.\n");

  // ── PHASE 1: Upload the CSV file to Foundry ─────────────────
  console.log("Uploading CSV file to Azure AI Foundry...");
  const fileStream = fs.createReadStream(DATA_FILE_PATH);
  const uploadedFile = await openAIClient.files.create({
    file: fileStream,
    purpose: "assistants",
  });
  console.log(`✓ File uploaded!`);
  console.log(`  File ID   : ${uploadedFile.id}`);
  console.log(`  File name : ${uploadedFile.filename}\n`);

  // ── PHASE 2: Create the agent with Code Interpreter ─────────
  console.log("Creating registered AI Agent with Code Interpreter + uploaded file...");
  const agent = await project.agents.createVersion("DataAnalystAgent", {
    kind: "prompt",
    model: MODEL_DEPLOYMENT,
    instructions: "You are a helpful data analyst assistant. " +
                  "Analyse the uploaded CSV file when asked.",
    tools: [
      {
        type: "code_interpreter",
        container: {
          type: "auto",
          file_ids: [uploadedFile.id],
        },
      },
    ],
  });
  console.log("✓ Agent created!");
  console.log(`  Agent ID      : ${agent.id}`);
  console.log(`  Agent Name    : ${agent.name}`);
  console.log(`  Agent Version : ${agent.version}\n`);

  // ── PHASE 3: Create a conversation and run the agent ─────────
  console.log("Creating conversation thread...");
  const conversation = await openAIClient.conversations.create();
  console.log(`✓ Conversation created (ID: ${conversation.id})\n`);

  const userPrompt =
    "Please analyse the uploaded CSV file and: " +
    "1) Show total sales, expenses and profit. " +
    "2) Identify the most and least profitable months. " +
    "3) Create a bar chart of monthly profit and save it as a PNG file.";

  console.log("─".repeat(60));
  console.log("USER MESSAGE:");
  console.log("─".repeat(60));
  console.log(userPrompt);
  console.log("─".repeat(60) + "\n");

  console.log("Running Agent via Responses API...\n");
  const response = await openAIClient.responses.create(
    {
      conversation: conversation.id,
      input: userPrompt,
    },
    {
      body: {
        agent: {
          name: agent.name,
          type: "agent_reference",
        },
      },
    }
  );

  // ── PHASE 4: Display the text response ───────────────────────
  console.log("AGENT RESPONSE:");
  console.log("─".repeat(60));
  console.log(response.output_text);
  console.log("─".repeat(60) + "\n");

  // ── PHASE 5: Download any generated output files ─────────────
  const generatedFiles = extractFileCitations(response);

  if (generatedFiles.length > 0) {
    console.log(`Found ${generatedFiles.length} generated file(s) – downloading...\n`);

    if (!fs.existsSync(DOWNLOADS_DIR)) {
      fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
    }

    for (const citation of generatedFiles) {
      console.log(`Downloading: ${citation.filename} (ID: ${citation.file_id})`);
      try {
        const fileContent = await openAIClient.containers.files.content.retrieve(
          citation.file_id,
          { container_id: citation.container_id }
        );

        const buffer = Buffer.from(await fileContent.arrayBuffer());
        const safeName = path.basename(citation.filename || `${citation.file_id}.bin`);
        const localPath = path.join(DOWNLOADS_DIR, safeName);

        fs.writeFileSync(localPath, buffer);
        console.log(`✓ Saved to: ${localPath}`);
      } catch (err) {
        console.warn(`Could not download ${citation.filename}: ${err.message}`);
      }
    }
    console.log();
  } else {
    console.log("No output files were generated by Code Interpreter.\n");
  }

  // ── PHASE 6: Check Code Interpreter usage in response ────────
  console.log("RESPONSE ANALYSIS:");
  console.log("─".repeat(60));
  let ciUsed = false;
  if (response.output && Array.isArray(response.output)) {
    for (const item of response.output) {
      if (item.type === "code_interpreter_call") {
        ciUsed = true;
        console.log("✓ CODE INTERPRETER WAS USED!");
        if (item.code)       console.log(`\n  Python code executed:\n  ${"─".repeat(40)}\n${indent(item.code, 2)}\n  ${"─".repeat(40)}`);
        if (item.output)     console.log(`\n  Output:\n${indent(item.output, 4)}`);
      }
    }
  }
  if (!ciUsed) console.log("ℹ Code Interpreter output block not found in response.");
  console.log("─".repeat(60) + "\n");

  // ── PHASE 7: Cleanup ─────────────────────────────────────────
  await pressEnterToContinue("Press ENTER to clean up resources (conversation, file, agent)...");

  console.log("Cleaning up resources...");

  await openAIClient.conversations.delete(conversation.id);
  console.log("✓ Conversation deleted.");

  await openAIClient.files.delete(uploadedFile.id);
  console.log(`✓ Uploaded file deleted (ID: ${uploadedFile.id}).`);

  await project.agents.deleteVersion(agent.name, agent.version);
  console.log(`✓ Agent deleted (${agent.name} v${agent.version}).`);

  console.log("\nDone! ✓");
}

// ── Helpers Functions ────────────────────────────────────────────────
function extractFileCitations(response) {
  const citations = [];
  if (!response.output || !Array.isArray(response.output)) return citations;

  for (const item of response.output) {
    if (item.type === "message" && Array.isArray(item.content)) {
      for (const block of item.content) {
        if (block.type === "output_text" && Array.isArray(block.annotations)) {
          for (const ann of block.annotations) {
            if (ann.type === "container_file_citation") {
              citations.push({
                file_id:      ann.file_id,
                filename:     ann.filename || ann.file_id,
                container_id: ann.container_id,
              });
            }
          }
        }
      }
    }
  }
  return citations;
}

function indent(text, n) {
  const pad = " ".repeat(n);
  return String(text).split("\n").map(l => pad + l).join("\n");
}

function pressEnterToContinue(message = "Press ENTER to continue...") {
  process.stdout.write(`\n${message} `);
  return new Promise(resolve => {
    process.stdin.setRawMode(false);
    process.stdin.resume();
    process.stdin.once("data", () => {
      process.stdin.pause();
      console.log();
      resolve();
    });
  });
}

// ── Entry point ────────────────────────────────────────────────
main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
