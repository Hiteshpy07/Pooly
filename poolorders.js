import express from "express";
import OpenAI from "openai";

process.loadEnvFile?.();

const app = express()
app.use(express.json())

const gemini = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});
const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";



let orders = []
let adresses = []

app.get('/', (req, res) => {
    res.send("lets pool orders , server working")
})

app.post('/order', (req, res) => {
    let body = req.body
    orders.push(body.order_items)
    adresses.push(body.address)
    return res.send("Order placed successfully")

})

app.post('/order-host', (req, res) => {
    let body = req.body
    orders.push(body.host_order_items)
    adresses.push(body.address)

    return res.send("Order placed successfully")
})

app.get('/final-order', async (req, res) => {

    try {
    if (orders.length === 0) {
      return res.status(400).json({ error: "No orders placed yet to summarize" });
    }
    const hostAddress = adresses[adresses.length - 1] || "Primary Host Address";
    const completion = await gemini.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are an order consolidator for a group grocery pool (Pooly).
1. Group and sum quantities of identical or matching items.
2. Produce a clean consolidated list of all items to order to the Host's address.
3. Calculate the bill split per participant.`
        },
        {
          role: "user",
          content: `Here are all pooled orders from participants:
${JSON.stringify(orders, null, 2)}
Delivery Target (Host Address):
${JSON.stringify(hostAddress, null, 2)}
Please generate the final consolidated order summary and bill split.`
        }
      ]
    });
    const summary = completion.choices[0].message.content;
    return res.json({
      success: true,
      deliveryAddress: hostAddress,
      totalOrders: orders.length,
      summary: summary
    });
  } catch (error) {
    console.error("Gemini Error:", error);
    return res.status(500).json({ error: error.message });
  }
});


app.listen(3000, () => {
    console.log("Server is running on port 3000")
})
