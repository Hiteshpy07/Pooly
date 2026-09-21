process.loadEnvFile?.();
import OpenAI from "openai";
import {
  Agent,
  Runner,
  MCPServerStreamableHttp,
  OpenAIChatCompletionsModel,
} from "@openai/agents";
import { swiggyOAuthProvider } from "./swiggy-oauth.js";

// Determine model provider (Gemini or OpenAI)
let agentModel = undefined;

if (process.env.GEMINI_API_KEY) {
  const geminiClient = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  });
  const modelName = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  agentModel = new OpenAIChatCompletionsModel(geminiClient, modelName);
  console.log(`🤖 Using Google Gemini (${modelName})`);
} else if (process.env.OPENAI_API_KEY) {
  console.log("🤖 Using OpenAI (default)");
}

const swiggyFood = new MCPServerStreamableHttp({
  url: "https://mcp.swiggy.com/food",
  authProvider: swiggyOAuthProvider,
});

const agent = new Agent({
  name: "FoodOrderingAgent",
  instructions: "Help users order food on Swiggy. Always call get_addresses first.",
  model: agentModel,
  mcpServers: [swiggyFood],
});

await swiggyOAuthProvider.ensureAuthenticated();
await swiggyFood.connect();

const runner = new Runner();
console.log("🚀 Running FoodOrderingAgent...\n");
const result = await runner.run(agent, "show mme some good biryani to my work address.");
console.log("\n📋 Final Output:\n", result.finalOutput);