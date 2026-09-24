process.loadEnvFile?.();
import OpenAI from "openai";
import {
  Agent,
  Runner,
  MCPServerStreamableHttp,
  OpenAIChatCompletionsModel,
} from "@openai/agents";
import { fileURLToPath } from "node:url";
import { swiggyOAuthProvider } from "./swiggy-oauth.js";

let agentModel = undefined
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

//SMART WAY OF USING FALLBACK MIDELS FOR NOW  

// Swiggy Instamart MCP Server Endpoint
export const swiggyInstamart = new MCPServerStreamableHttp({
  url: "https://mcp.swiggy.com/im",
  authProvider: swiggyOAuthProvider,
});

// Instamart Agent
export const instamartAgent = new Agent({
  name: "InstamartAgent",
  instructions: `You are Pooly's grocery shopping assistant powered by Swiggy Instamart.
Follow these guidelines:
1. Always call get_addresses first to find the user's delivery addresses unless an addressId or location is already provided.
2. Search products using search_products. Provide helpful summaries of available products including pack sizes, prices, and variant options.
3. If the user wants frequently ordered items, check your_go_to_items.
4. Manage the cart using get_cart, update_cart (requires skuId, spinId, quantity), and clear_cart.
5. Track orders using get_orders or track_order when requested.`,
  model: agentModel,
  mcpServers: [swiggyInstamart],
});

/**
 * Main execution function if run directly from terminal
 */
async function main() {
  await swiggyOAuthProvider.ensureAuthenticated();
  await swiggyInstamart.connect();

  if(process.env.ADDRESS){
  const addressData = JSON.parse(process.env.ADDRESS);
  const response = await swiggyInstamart.callTool("create_address", addressData);
  console.log("Create Address Response:", response);
}
  const runner = new Runner();
  console.log("Swiggy Instamart MCP Agent Connected!\n");

  const query = process.argv.slice(2).join(" ") || "Check my  OTHER addresses and search for bread, milk and eggs";
  console.log(`Query: "${query}"\n`);

  const result = await runner.run(instamartAgent, query);
  console.log("\n Final Output:\n", result.finalOutput);
}

// Execute main function if run directly from terminal
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(console.error);
}


