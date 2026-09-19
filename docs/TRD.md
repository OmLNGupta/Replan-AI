# TECHNICAL REQUIREMENT DOCUMENT (TRD)
## AI Study Recovery Coach: System Architecture & AWS Engineering Spec

- **Target Infrastructure:** 100% Serverless AWS
- **Backend Runtime:** Python 3.12 (AWS Lambda)
- **Core Services:** Bedrock, DynamoDB, API Gateway, CloudWatch
- **Frontend:** React SPA / Vite / Tailwind CSS
- **Doc Version:** 1.0 (MVP Scope Lock)

---

### 1. High-Level Serverless Architecture
- **Presentation:** Single-page dashboard with luminous aerospace glassmorphism, responsive controls, and 360° Three.js Study Recovery Orbit.
- **API Entry Point:** Amazon API Gateway (HTTP API v2) with CORS, rate limiting, and low-latency Lambda proxy.
- **Compute / Logic:** AWS Lambda (Python 3.12) stateless microservice executing priority math and Bedrock prompt orchestration.
- **Generative AI:** Amazon Bedrock (`anthropic.claude-3-5-sonnet` / `amazon.nova-lite-v1:0`).
- **Persistence Store:** Amazon DynamoDB Single-Table Design (`StudyRecoveryTable`).
- **Observability & IAM:** CloudWatch structured JSON log streams and least-privilege IAM roles.

---

### 2. DynamoDB Schema: Single-Table Architecture
Single table named `StudyRecoveryTable`:

| Entity | PK | SK | Attributes |
|---|---|---|---|
| **Task Item** | `USER#<userId>` | `TASK#<taskId>` | `title`, `category`, `deadline`, `importance` (1-3), `difficulty` (1-5), `estMinutes`, `status` (`PENDING`\|`COMPLETED`\|`MISSED`), `loggedMinutes`, `createdAt` |
| **Daily Context** | `USER#<userId>` | `CONTEXT#<date>` | `availableMinutes`, `preferredTimeWindow`, `energyLevel` (`HIGH`\|`NORMAL`\|`LOW`), `updatedAt` |
| **Recovery Plan** | `USER#<userId>` | `PLAN#<date>#v<ver>` | `version`, `timeBlocks` (list of maps: `blockId`, `startTime`, `endTime`, `durationMinutes`, `taskId`, `title`, `actionItem`, `isRest`), `deferredTasks`, `recoverySummary`, `generatedAt` |

---

### 3. Deterministic Priority Engine Formulation
Prioritization is calculated deterministically in Lambda before invoking Amazon Bedrock to prevent LLM hallucinations:

$$\text{PriorityScore} = (0.45 \times \text{UrgencyScore}) + (0.35 \times \text{ImportanceWeight}) + (0.20 \times \text{DifficultyFactor})$$

- $\text{UrgencyScore} = \max(0, 100 - (\text{HoursUntilDeadline} \times 1.25))$
- $\text{ImportanceWeight}$: $\text{Low}(1) \to 25 \mid \text{Medium}(2) \to 60 \mid \text{High}(3) \to 100$
- $\text{DifficultyFactor} = \text{Difficulty} \times 20$ (1 to 5 scale)

---

### 4. Amazon Bedrock Orchestration & Controlled Schema
- Temperature: 0.2
- Max tokens: 2048
- Enforces strict JSON output schema.
- Automatic greedy bin-packing fallback scheduler if Bedrock times out or throttles.

---

### 5. API Gateway REST Endpoints
- `POST /tasks`: Create new task item.
- `GET /tasks`: Query user tasks by status (`all` / `pending`).
- `PATCH /tasks/{id}`: Update task progress status and logged minutes.
- `POST /plan/generate`: Generate initial recovery plan.
- `POST /plan/replan`: Trigger adaptive recovery rebalance loop.
