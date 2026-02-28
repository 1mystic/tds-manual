<a name="section-18"></a>
# SECTION 18 — Real-Time & Streaming Data (Kafka)

While batch processing (ETL/ELT running every 24 hours) solves 90% of business problems, the remaining 10% require sub-second latency (fraud detection, live dashboards, recommendation engines). 

Apache Kafka is the nervous system of modern streaming infrastructure. It acts as a massive, distributed, fault-tolerant message queue.

## 18.1 Kafka Concepts

```
PRODUCER  →  TOPIC  →  CONSUMER GROUP
                ↓
            PARTITIONS (parallel lanes within a topic)
            Each message has: offset, timestamp, key, value

Key concepts:
- Topic: named stream of records (like a table)
- Partition: ordered, immutable log (enables parallel processing)
- Consumer Group: multiple consumers sharing work, each partition read by one consumer
- Offset: position of a message in a partition
- Retention: how long messages are stored (e.g., 7 days)
```

## 18.2 Kafka Producer (Python)

```python
# pip install confluent-kafka
from confluent_kafka import Producer
import json
from datetime import datetime

conf = {
    "bootstrap.servers": "localhost:9092",
    "client.id": "my-producer",
    "acks": "all",              # wait for all replicas
    "retries": 3,
    "compression.type": "gzip"
}
producer = Producer(conf)

def delivery_report(err, msg):
    if err:
        print(f"Message delivery failed: {err}")
    else:
        print(f"Delivered to {msg.topic()} [{msg.partition()}] @ offset {msg.offset()}")

# Produce messages
def produce_order(order: dict):
    producer.produce(
        topic="orders",
        key=str(order["user_id"]).encode("utf-8"),  # key for partitioning
        value=json.dumps(order).encode("utf-8"),
        callback=delivery_report
    )
    producer.poll(0)   # trigger delivery reports

orders = [
    {"order_id": 1, "user_id": 101, "amount": 99.99, "ts": datetime.utcnow().isoformat()},
    {"order_id": 2, "user_id": 102, "amount": 149.0, "ts": datetime.utcnow().isoformat()},
]

for order in orders:
    produce_order(order)

producer.flush()  # wait for all messages to be delivered
```

## 18.3 Kafka Consumer (Python)

```python
from confluent_kafka import Consumer
import json

conf = {
    "bootstrap.servers": "localhost:9092",
    "group.id": "orders-consumer-group",
    "auto.offset.reset": "earliest",    # start from beginning if no offset
    "enable.auto.commit": False          # manual commit for exactly-once
}
consumer = Consumer(conf)
consumer.subscribe(["orders"])

def process_order(order: dict):
    """Your processing logic here."""
    print(f"Processing order {order['order_id']} for user {order['user_id']}")

try:
    while True:
        msg = consumer.poll(timeout=1.0)
        if msg is None:
            continue
        if msg.error():
            print(f"Consumer error: {msg.error()}")
            continue
        
        order = json.loads(msg.value().decode("utf-8"))
        process_order(order)
        
        # Manual commit (after successful processing)
        consumer.commit(asynchronous=False)

except KeyboardInterrupt:
    pass
finally:
    consumer.close()
```

## 18.4 Stream Processing with Faust

```python
# pip install faust-streaming
import faust
import json

app = faust.App("orders-processor", broker="kafka://localhost:9092")

class Order(faust.Record):
    order_id: int
    user_id: int
    amount: float
    status: str

orders_topic = app.topic("orders", value_type=Order)
enriched_topic = app.topic("enriched_orders")

@app.agent(orders_topic)
async def process_orders(orders):
    async for order in orders:
        # Enrich the order
        enriched = {
            "order_id": order.order_id,
            "user_id": order.user_id,
            "amount": order.amount,
            "tier": "premium" if order.amount > 100 else "standard",
            "processed": True
        }
        await enriched_topic.send(value=enriched)
        print(f"Processed order {order.order_id}")

if __name__ == "__main__":
    app.main()
```

---

