# PRODUCT REQUIREMENT DOCUMENT (PRD)
## AI Study Recovery Coach
### Adaptive Schedule Restoration & Intelligent Workload Rebalancer

- **Project:** AI Study Recovery Coach
- **Event:** AWS First Commit (Bharat Builds Tour 2026)
- **Team:** Fast & Furious (Sprint Timeline: Sept 17 - 20, 2026 | 4-Day Hybrid)
- **Team Lead:** Om Laxmi Narayan Gupta
- **Members:** Mohd Sajid, Mohd Saifi Ansari, Ojasva Prakash
- **Doc Version:** 1.0 (MVP Scope Lock)
- **Target Stack:** AWS Bedrock, Lambda, DynamoDB, API Gateway

---

### 1. Executive Summary & Product Vision
Students and self-directed learners continually face an inescapable operational reality: static study timetables fail upon first contact with disruption. When an unexpected lab assignment, difficult lecture, fatigue, or personal emergency causes a task to slip, conventional calendars and to-do lists provide zero dynamic recourse. Unfinished items accumulate into an intimidating backlog, imposing severe cognitive friction through "replanning paralysis."

The AI Study Recovery Coach fundamentally shifts the paradigm from rigid schedule enforcement to continuous, automated recovery. By synthesizing deterministic multi-factor priority algorithms with generative AI reasoning powered by Amazon Bedrock, the application ingests unfinished study backlogs, evaluates real-time time constraints, and outputs immediately executable, guilt-free recovery schedules.

**Product North Star:** Transform study planning from a source of failure-induced anxiety into a resilient feedback loop where missing a session instantly yields an optimized, feasible path forward.

---

### 2. Target Audience & User Personas
1. **Undergrad Engineer (e.g., CS / IT student):** Juggling heavy college syllabus, semester exams, lab records, and hackathons. Missed 2-hour DSA block triggers cascade delays across coursework.
2. **Competitive Self-Learner (DSA & Placements):** Solving daily LeetCode, system design, and building web/cloud projects. Roadblocks consume unplanned hours.
3. **Burnout-Prone Student:** Over-optimistic planning leads to chronic under-delivery, demotivation, and guilt from seeing overdue badges.

---

### 3. Scope Boundaries: In-Scope vs. Out-of-Scope (4-Day Sprint)
#### MVP In-Scope (Strict Commit)
- Structured task creation (title, deadline, importance, difficulty, estimated time).
- Real-time daily study capacity declaration (e.g., 3 hours available today).
- Deterministic mathematical priority scoring ($0.45U + 0.35I + 0.20D$).
- Amazon Bedrock-powered personalized recovery plan generator.
- Live task progress and completion status persistence via DynamoDB.
- Instant 1-click "Replan / Recover" workflow when disruptions occur.
- Responsive, clean dashboard with clear active vs completed views.

#### Out-of-Scope / Future Roadmap
- Multi-agent automated debates or autonomous web browsing agents.
- Complex social feeds, friend leaderboards, and peer chat rooms.
- Gamification currencies, unlockable badges, or avatars.
- Third-party calendar 2-way sync (Google Calendar / Outlook OAuth).
- Long-form historical statistical analytics and predictive GPA models.
- Native mobile iOS / Android binary packaging.

---

### 4. Detailed Functional Requirements
- **FR-1: Task & Constraint Ingestion:** Submit tasks with Title, Category, Deadline, Importance (High=3, Med=2, Low=1), Subjective Difficulty (1-5), Estimated Time (mins), and daily available study hours.
- **FR-2: Deterministic Priority Engine:** Computes composite urgency/impact score prior to sending data to LLM.
- **FR-3: AI Recovery Plan Generation:** Amazon Bedrock synthesizes prioritized tasks with cognitive load management rules (max 90m deep work blocks, 10-15m rest intervals, heavy topics scheduled when fresh).
- **FR-4: Dynamic Progress Tracking:** Mark tasks 'Completed', 'In Progress', or 'Partially Complete' with logged minutes.
- **FR-5: Adaptive Replanning Loop:** If a task is missed or constraints change, user clicks 'Adapt Plan' to recalculate remaining workload against new capacity.
