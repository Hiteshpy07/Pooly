import express from "express";
const app = express()
app.use(express.json())

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

app.get('/complete-orders', (req, res) => {
    res.send({ orders, adresses })
})

app.listen(3000, () => {
    console.log("Server is running on port 3000")
})
