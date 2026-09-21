Pooly

Order groceries together. Split the bill fairly. Pay less in fees.

Ordering with friends is messy. One person places the order, everyone pays their own delivery and handling fees, and then the "who owes what" chat begins. Pooly puts everyone in one room, adds up the bill, and places a single order.

🚧 Work in progress. I'm building this in public over two weeks.

How it works
🏠 1. Host opens a room
      shares a link or 6-letter code
            ↓
👯 2. Friends join & add items
      type "2 milk and eggs", AI finds them
            ↓
🧮 3. The bill is split fairly
      plain code does the math, not AI
            ↓
💸 4. Everyone pays the host on UPI
            ↓
🛵 5. Host places ONE Instamart order
      one delivery, fewer fees each
Little things I care about
🧮 The AI never touches your money. It finds items and explains the split. Plain code does the maths, in whole paise, so shares always add up exactly.
✋ The host always confirms. No order goes out without a tap from the host.
💸 Pay first, order after. The order is only placed once everyone's payment is confirmed, so nobody is left holding the bill.
🔒 Tokens stay on the server, encrypted. Rooms delete their data after delivery.
Built with

Next.js · TypeScript · Postgres + Prisma · Swiggy Instamart MCP · a small LLM for item entry

Status
 Rooms and live basket
 Fair bill split
 UPI payment links and host confirmation
 AI item entry ("2 milk and eggs")
 Real Instamart cart and checkout
 Hostel pilot with real numbers
Run it locally
bash
git clone <your-repo-url>
cd pooldrop
cp .env.example .env      # add your own keys, never commit them
npm install
npx prisma migrate dev
npm run dev

By default it runs on a mock catalog, so you can try it without any Swiggy access.

Demo

🎥 Demo video: coming soon 🔗 Live demo: coming soon

A note

PoolDrop is an independent project. It is not affiliated with or endorsed by Swiggy. It uses Swiggy Instamart's public MCP APIs.

License

MIT
