<a name="section-20"></a>
# SECTION 20 — LLMs & AI in Data Workflows (2026)

By 2026, Large Language Models are no longer just chatbots; they are functional components within data engineering pipelines. They excel at unstructured data extraction, sentiment analysis, semantic deduplication, and code generation.

> [!IMPORTANT]
> When using LLMs in programmatic loops, always enforce structured outputs (like JSON) using tools like `Pydantic` or OpenAI's JSON mode. Never rely on raw text parsing.

## 20.1 OpenAI / Anthropic API for Data Tasks

```python
# pip install openai anthropic
from openai import OpenAI
import anthropic
import pandas as pd
import json

# OpenAI
openai_client = OpenAI(api_key="sk-...")

def ask_gpt(prompt: str, model: str = "gpt-4o", temperature: float = 0) -> str:
    response = openai_client.chat.completions.create(
        model=model,
        temperature=temperature,
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content

# Anthropic Claude
claude = anthropic.Anthropic(api_key="sk-ant-...")

def ask_claude(prompt: str) -> str:
    message = claude.messages.create(
        model="claude-opus-4-6",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}]
    )
    return message.content[0].text

# Use LLM to classify free-text data
def classify_support_tickets(tickets: list[str]) -> list[str]:
    categories = ["billing", "technical", "shipping", "returns", "general"]
    results = []
    for ticket in tickets:
        prompt = f"""Classify this support ticket into exactly one of: {categories}
Ticket: {ticket}
Return only the category name, nothing else."""
        category = ask_gpt(prompt).strip().lower()
        results.append(category)
    return results

# Use LLM to generate SQL
def nl_to_sql(question: str, schema: str) -> str:
    prompt = f"""You are a SQL expert. Given this schema:
{schema}

Write a SQL query to answer: {question}
Return only the SQL query, no explanation."""
    return ask_claude(prompt)

schema = """
Table: orders (order_id, user_id, amount, status, created_at)
Table: users (user_id, email, country, signup_date)
"""
sql = nl_to_sql("What is the average order value by country for the last 30 days?", schema)
print(sql)
```

## 20.2 LLM for Data Quality & Enrichment

```python
# Use LLM to extract structured data from unstructured text
def extract_structured(text: str) -> dict:
    prompt = f"""Extract information from this text and return JSON with keys:
company_name, industry, revenue (in millions USD), employee_count, founding_year.
Use null for missing values.

Text: {text}

Return only valid JSON."""
    
    response = ask_gpt(prompt)
    # Strip markdown code fences if present
    clean = response.strip().removeprefix("```json").removesuffix("```").strip()
    return json.loads(clean)

# Batch processing with rate limiting
import time

def batch_extract(texts: list[str], delay: float = 0.5) -> list[dict]:
    results = []
    for i, text in enumerate(texts):
        try:
            result = extract_structured(text)
            results.append(result)
        except Exception as e:
            results.append({"error": str(e)})
        if i < len(texts) - 1:
            time.sleep(delay)
    return results

# Use embeddings for semantic similarity
def get_embeddings(texts: list[str]) -> list[list[float]]:
    response = openai_client.embeddings.create(
        input=texts,
        model="text-embedding-3-small"
    )
    return [item.embedding for item in response.data]

# Semantic deduplication
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

def find_similar_records(df: pd.DataFrame, text_col: str, threshold: float = 0.95):
    embeddings = get_embeddings(df[text_col].tolist())
    sim_matrix = cosine_similarity(embeddings)
    duplicates = []
    for i in range(len(sim_matrix)):
        for j in range(i+1, len(sim_matrix)):
            if sim_matrix[i][j] >= threshold:
                duplicates.append((i, j, sim_matrix[i][j]))
    return duplicates
```

## 20.3 LLM-Powered Data Pipeline (LangChain)

```python
# pip install langchain langchain-openai
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
from langchain.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field
from typing import List, Optional

# Structured output with Pydantic
class ProductReview(BaseModel):
    sentiment: str = Field(description="positive, negative, or neutral")
    rating: int = Field(description="1-5 estimated rating")
    topics: List[str] = Field(description="main topics mentioned")
    summary: str = Field(description="one sentence summary")

parser = PydanticOutputParser(pydantic_object=ProductReview)
llm = ChatOpenAI(model="gpt-4o", temperature=0)

def analyze_review(review_text: str) -> ProductReview:
    messages = [
        SystemMessage(content="You analyze product reviews and return structured data."),
        HumanMessage(content=f"""Analyze this review:
{review_text}

{parser.get_format_instructions()}""")
    ]
    response = llm.invoke(messages)
    return parser.parse(response.content)

# Batch reviews
reviews = [
    "Amazing product! Fast shipping, great quality. Would buy again. 10/10",
    "Terrible experience. Broke after 2 days. Customer service was useless.",
    "It's ok. Does what it says but nothing special. Delivery was slow."
]

for review in reviews:
    result = analyze_review(review)
    print(f"Sentiment: {result.sentiment} | Rating: {result.rating} | Topics: {result.topics}")
```

---

