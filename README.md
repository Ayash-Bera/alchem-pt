# 🧪 Alchemyst Platform

> **AI-powered research platform** with deep analysis capabilities and real-time monitoring

## 🌐 Live Platform

| Service | URL | Description |
|---------|-----|-------------|
| 🎨 **Frontend** | http://34.68.86.10:3000 | Research Dashboard & Job Submission |
| 🚀 **API** | http://34.68.86.10:8080 | REST API & WebSocket Server |
| 📊 **Grafana** | http://35.209.99.170:3000 | Metrics & Monitoring Dashboard |
| 🐰 **RabbitMQ** | http://35.209.28.176:15672 | Queue Management UI |

## 🏗️ Architecture

```mermaid
graph TD
    UI[React Dashboard] --> API[Express API]
    API --> JOBS[AgendaJS Jobs]
    API --> QUEUE[RabbitMQ]
    JOBS --> AI[Alchemyst AI]
    JOBS --> DB[(MongoDB)]
    API --> METRICS[Grafana]
    QUEUE --> JOBS
    
    style UI fill:#61dafb,stroke:#000,color:#000
    style API fill:#68a063,stroke:#000,color:#fff
    style JOBS fill:#ff6b6b,stroke:#000,color:#fff
    style AI fill:#9c27b0,stroke:#000,color:#fff
    style DB fill:#4caf50,stroke:#000,color:#fff
    style METRICS fill:#ff9800,stroke:#000,color:#fff
    style QUEUE fill:#607d8b,stroke:#000,color:#fff
```

## ✨ What It Does

**🔬 Deep Research Agent**
- Multi-step AI research with intelligent planning
- GitHub repository analysis and code review
- Document summarization and synthesis

**📈 Real-time Monitoring**
- Live job progress tracking
- Cost and token usage analytics
- System health dashboards

**⚡ Smart Processing**
- Parallel execution for faster results
- Automatic error recovery and retries
- Cost-optimized token allocation

## 🚀 Quick Start

```bash
# Research something!
curl -X POST http://34.68.86.10:8080/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "type": "deep-research",
    "data": {
      "topic": "artificial intelligence in healthcare",
      "researchDepth": "medium"
    }
  }'
```

## 🛠️ Tech Stack

```mermaid
flowchart LR
    React --> Express
    Express --> AgendaJS
    Express --> RabbitMQ
    AgendaJS --> MongoDB
    Express --> Grafana
    AgendaJS --> Alchemyst
    
    style React fill:#61dafb,color:#000
    style Express fill:#68a063,color:#fff
    style AgendaJS fill:#ff6b6b,color:#fff
    style RabbitMQ fill:#ff6600,color:#fff
    style MongoDB fill:#4caf50,color:#fff
    style Grafana fill:#ff9800,color:#fff
    style Alchemyst fill:#9c27b0,color:#fff
```

---

**🌟 Deployed on Google Cloud Platform • Built with React + Express.js + MongoDB + RabbitMQ**
