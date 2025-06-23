# Alchemyst Platform API Documentation

Base URL: `http://35.209.5.151:8080/api`

## Core Job Management

### Create Deep Research Job
**POST** `/jobs`

Create a new deep research job with intelligent multi-step analysis.

```json
{
  "type": "deep-research",
  "data": {
    "topic": "artificial intelligence in healthcare",
    "researchDepth": "medium",
    "sources": [],
    "deliverables": ["summary", "report", "recommendations"],
    "options": {},
    "priority": "normal"
  }
}
```

**Response:**
```json
{
  "success": true,
  "job": {
    "id": "507f1f77bcf86cd799439011",
    "name": "deep-research",
    "status": "scheduled",
    "progress": 0,
    "createdAt": "2025-06-23T18:30:00Z"
  }
}
```

### Check Job Status
**GET** `/jobs/{jobId}`

Get complete job information including current status and results.

**Response:**
```json
{
  "success": true,
  "job": {
    "id": "507f1f77bcf86cd799439011",
    "name": "deep-research",
    "status": "running",
    "progress": 45,
    "data": {
      "topic": "artificial intelligence in healthcare"
    },
    "result": null,
    "lastRunAt": "2025-06-23T18:31:00Z",
    "metrics": {
      "cost_usd": 0.15,
      "tokens_used": 2400
    }
  }
}
```

### Get Job Progress
**GET** `/jobs/{jobId}/progress`

Real-time progress tracking for active jobs.

**Response:**
```json
{
  "success": true,
  "progress": {
    "jobId": "507f1f77bcf86cd799439011",
    "status": "running",
    "progress": 45,
    "estimatedCompletion": "2025-06-23T18:45:00Z"
  }
}
```

### Cancel Job
**DELETE** `/jobs/{jobId}`

Cancel a running or scheduled job.

**Response:**
```json
{
  "success": true,
  "message": "Job cancelled successfully"
}
```

## Other Job Types

### GitHub Analysis Job
**POST** `/jobs`

```json
{
  "type": "github-analysis",
  "data": {
    "repository": "https://github.com/user/repo",
    "analysisType": "full",
    "options": {}
  }
}
```

### Document Summary Job
**POST** `/jobs`

```json
{
  "type": "document-summary",
  "data": {
    "document": "document content or URL",
    "summaryType": "comprehensive",
    "maxLength": 1000
  }
}
```

## Job Management

### List All Jobs
**GET** `/jobs`

**Query Parameters:**
- `type` - Filter by job type
- `status` - Filter by status (pending, running, completed, failed)
- `limit` - Number of jobs to return (max 100)
- `skip` - Number of jobs to skip

**Response:**
```json
{
  "success": true,
  "jobs": [...],
  "total": 25,
  "limit": 50,
  "skip": 0
}
```

### Retry Failed Job
**POST** `/jobs/{jobId}/retry`

Creates a new job with the same data as a failed job.

**Response:**
```json
{
  "success": true,
  "originalJobId": "507f1f77bcf86cd799439011",
  "newJob": {
    "id": "507f1f77bcf86cd799439012",
    "status": "scheduled"
  }
}
```

## Job Information

### Get Job Types
**GET** `/jobs/types/info`

Get information about available job types and their requirements.

**Response:**
```json
{
  "success": true,
  "jobTypes": {
    "deep-research": {
      "name": "Deep Research Analysis",
      "description": "Conduct multi-step research on complex topics",
      "requiredFields": ["topic"],
      "estimatedDuration": "15-45 minutes",
      "estimatedCost": "$0.25-$1.00"
    }
  }
}
```

### Get Job Statistics
**GET** `/jobs/stats/overview`

**Query Parameters:**
- `timeRange` - 1h, 24h, 7d (default: 24h)

**Response:**
```json
{
  "success": true,
  "statistics": {
    "timeRange": "24h",
    "statusBreakdown": [
      {"status": "completed", "count": 15},
      {"status": "running", "count": 3}
    ],
    "typeBreakdown": [
      {"job_type": "deep-research", "count": 8}
    ]
  }
}
```

## System Management

### Clear All Jobs
**POST** `/jobs/clear-all`

Remove all jobs from the system (development use).

**Response:**
```json
{
  "success": true,
  "clearedJobs": 25,
  "message": "Cleared 25 jobs"
}
```

### System Status
**GET** `/jobs/system-status`

Check AgendaJS queue status.

**Response:**
```json
{
  "success": true,
  "status": {
    "isRunning": true,
    "runningJobs": 2,
    "scheduledJobs": 5,
    "totalJobs": 20
  }
}
```

## Health & Monitoring

### Basic Health Check
**GET** `/health`

Simple health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-06-23T18:30:00Z",
  "uptime": 3600,
  "version": "1.0.0"
}
```

### Detailed Health Check
**GET** `/health/detailed`

Comprehensive system health including all services.

**Response:**
```json
{
  "status": "healthy",
  "services": {
    "database": {"healthy": true},
    "rabbitmq": {"healthy": true},
    "alchemyst_api": {"healthy": true}
  }
}
```

### Test Alchemyst API
**GET** `/health/alchemyst-test`

Test connection to Alchemyst API service.

## Metrics

### Concurrency Metrics
**GET** `/metrics/concurrency`

Current job concurrency and queue metrics.

### Cost Metrics
**GET** `/metrics/costs`

**Query Parameters:**
- `timeRange` - 1h, 24h, 7d, 30d

**Response:**
```json
{
  "success": true,
  "metrics": {
    "totalCost": 15.47,
    "costsByType": [
      {"job_type": "deep-research", "total_cost": 8.20}
    ]
  }
}
```

### Performance Metrics
**GET** `/metrics/performance`

Job processing performance and success rates.

### Dashboard Metrics
**GET** `/metrics/dashboard`

Aggregated metrics for dashboard display.

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message",
  "timestamp": "2025-06-23T18:30:00Z",
  "path": "/api/jobs"
}
```

**Common HTTP Status Codes:**
- `400` - Bad Request (invalid parameters)
- `404` - Not Found (job doesn't exist)
- `500` - Internal Server Error
- `503` - Service Unavailable

## WebSocket Events

Real-time job updates via Socket.IO:

**Events:**
- `job_created` - New job started
- `job_progress` - Progress update
- `job_completed` - Job finished
- `job_failed` - Job failed
- `system_status` - System status change

**Example Usage:**
```javascript
const socket = io('http://35.209.5.151:8080');
socket.on('job_progress', (data) => {
  console.log('Job progress:', data.progress);
});
```