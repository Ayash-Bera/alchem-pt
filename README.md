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
graph TB
    subgraph "🎯 User Interface"
        UI[React Dashboard<br/>34.68.86.10:3000]
    end
    
    subgraph "⚡ Processing Engine"
        API[Express API<br/>34.68.86.10:8080]
        JOBS[AgendaJS<br/>Job Processor]
        QUEUE[RabbitMQ<br/>Message Queue]
    end
    
    subgraph "🧠 AI Services"
        ALCHEMYST[Alchemyst AI<br/>Research Agent]
    end
    
    subgraph "💾 Data & Monitoring"
        DB[(MongoDB<br/>Job Storage)]
        METRICS[Grafana<br/>35.209.99.170:3000]
    end
    
    UI <==> API
    API --> JOBS
    JOBS <--> QUEUE
    JOBS <--> ALCHEMYST
    JOBS --> DB
    API --> METRICS
    
    style UI fill:#e1f5fe
    style ALCHEMYST fill:#f3e5f5
    style DB fill:#e8f5e8
    style METRICS fill:#fff3e0
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
graph LR
    A[React] --> B[Express.js]
    B --> C[AgendaJS]
    B --> D[RabbitMQ]
    C --> E[MongoDB]
    B --> F[OpenTelemetry]
    F --> G[Grafana]
    C --> H[Alchemyst AI]
    
    style A fill:#61dafb,color:#000
    style B fill:#68a063,color:#fff
    style C fill:#ff6b6b,color:#fff
    style H fill:#9c27b0,color:#fff
```

---

**🌟 Deployed on Google Cloud Platform • Built with React + Express.js + MongoDB + RabbitMQ**
