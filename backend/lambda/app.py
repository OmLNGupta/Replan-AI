"""
Replan AI - Study Recovery & Intelligent Workload Rebalancer
Serverless AWS Backend Handler (Python 3.12 / Amazon Bedrock / DynamoDB Single-Table)
"""

import json
import os
import re
import time
import uuid
import logging
import datetime
from decimal import Decimal
from typing import Dict, List, Any, Optional

# Setup standard structured logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Optional boto3 import with graceful fallback
try:
    import boto3
    from botocore.exceptions import ClientError, BotoCoreError
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False
    logger.info("boto3 not installed; running in offline simulation mode.")

DYNAMODB_TABLE_NAME = os.environ.get("DYNAMODB_TABLE_NAME", "StudyRecoveryTable")
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "us.anthropic.claude-3-5-sonnet-20241022-v2:0")

# Determine if running in AWS Lambda
IS_LAMBDA_ENV = bool(os.environ.get("AWS_LAMBDA_FUNCTION_NAME") or os.environ.get("AWS_EXECUTION_ENV"))

# Local storage path (development fallback only)
LOCAL_STORAGE_FILE = (
    "/tmp/dynamodb_local.json"
    if IS_LAMBDA_ENV
    else os.path.join(os.path.dirname(__file__), "..", "data", "dynamodb_local.json")
)

# ==============================================================================
# DECIMAL & DYNAMODB SERIALIZATION UTILITIES
# ==============================================================================

def to_dynamo_item(obj: Any) -> Any:
    """Recursively converts float types to Decimal for DynamoDB compatibility."""
    if isinstance(obj, float):
        return Decimal(str(round(obj, 4)))
    elif isinstance(obj, dict):
        return {k: to_dynamo_item(v) for k, v in obj.items() if v is not None}
    elif isinstance(obj, (list, tuple)):
        return [to_dynamo_item(v) for v in obj]
    return obj

def from_dynamo_item(obj: Any) -> Any:
    """Recursively converts Decimal types back to int/float for JSON responses."""
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    elif isinstance(obj, dict):
        return {k: from_dynamo_item(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [from_dynamo_item(v) for v in obj]
    return obj

class DecimalEncoder(json.JSONEncoder):
    """Custom JSONEncoder that handles Decimal instances gracefully."""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        if isinstance(obj, (datetime.date, datetime.datetime)):
            return obj.isoformat()
        return super().default(obj)

# ==============================================================================
# FR-02: DETERMINISTIC PRIORITY ENGINE
# Formula: PriorityScore = (0.45 * UrgencyScore) + (0.35 * ImportanceWeight) + (0.20 * DifficultyFactor)
# ==============================================================================

def calculate_priority(task: Dict[str, Any], reference_time: Optional[datetime.datetime] = None) -> Dict[str, Any]:
    """
    Computes explainable deterministic priority metrics for a task item.
    - UrgencyScore: max(0, 100 - (HoursUntilDeadline * 1.25))
    - ImportanceWeight: Low (1) -> 25 | Medium (2) -> 60 | High (3) -> 100
    - DifficultyFactor: Level (1-5) * 20
    """
    if reference_time is None:
        reference_time = datetime.datetime.now(datetime.timezone.utc)

    # 1. Hours Until Deadline
    deadline_str = task.get("deadline", "")
    hours_until_deadline = 48.0
    try:
        cleaned_deadline = str(deadline_str).replace("Z", "+00:00")
        if "T" in cleaned_deadline:
            if "+" in cleaned_deadline or "-" in cleaned_deadline[10:]:
                dl_dt = datetime.datetime.fromisoformat(cleaned_deadline)
            else:
                dl_dt = datetime.datetime.fromisoformat(cleaned_deadline).replace(tzinfo=datetime.timezone.utc)
        else:
            dl_dt = datetime.datetime.strptime(cleaned_deadline, "%Y-%m-%d").replace(
                hour=23, minute=59, second=59, tzinfo=datetime.timezone.utc
            )
        delta_seconds = (dl_dt - reference_time).total_seconds()
        hours_until_deadline = max(0.0, delta_seconds / 3600.0)
    except Exception:
        hours_until_deadline = 24.0

    urgency_score = max(0.0, 100.0 - (hours_until_deadline * 1.25))

    # 2. Importance Weight
    importance_raw = task.get("importance", 2)
    try:
        importance_num = int(importance_raw)
    except (ValueError, TypeError):
        importance_num = 2

    if importance_num <= 1:
        importance_weight = 25.0
    elif importance_num == 2:
        importance_weight = 60.0
    else:
        importance_weight = 100.0

    # 3. Difficulty Factor
    difficulty_raw = task.get("difficulty", 3)
    try:
        difficulty_num = max(1, min(5, int(difficulty_raw)))
    except (ValueError, TypeError):
        difficulty_num = 3
    difficulty_factor = float(difficulty_num * 20)

    # Composite Priority Score
    priority_score = (0.45 * urgency_score) + (0.35 * importance_weight) + (0.20 * difficulty_factor)
    priority_score = round(priority_score, 2)

    tier = "critical" if priority_score >= 75.0 else ("primary" if priority_score >= 45.0 else "deferrable")

    return {
        "urgencyScore": round(urgency_score, 2),
        "importanceWeight": round(importance_weight, 2),
        "difficultyFactor": round(difficulty_factor, 2),
        "priorityScore": priority_score,
        "tier": tier,
        "hoursUntilDeadline": round(hours_until_deadline, 1)
    }

def prioritize_tasks(tasks: List[Dict[str, Any]], reference_time: Optional[datetime.datetime] = None) -> List[Dict[str, Any]]:
    """Enriches and sorts pending tasks strictly by deterministic priority score."""
    enriched = []
    for t in tasks:
        p_info = calculate_priority(t, reference_time)
        item = dict(t)
        item.update(p_info)
        enriched.append(item)
    enriched.sort(key=lambda x: (x.get("priorityScore", 0), x.get("difficultyFactor", 0)), reverse=True)
    return enriched

# ==============================================================================
# DETERMINISTIC FALLBACK SCHEDULER (TRD Section 7: Resilient Greedy Bin-Packing)
# Cognitive load rules: Max 90m deep work block, 15m cognitive reset break.
# ==============================================================================

def deterministic_recovery_scheduler(
    prioritized_tasks: List[Dict[str, Any]],
    available_minutes: int,
    target_date: str,
    start_time_str: str = "17:00",
    disruption_reason: Optional[str] = None
) -> Dict[str, Any]:
    plan_id = f"plan-{uuid.uuid4().hex[:8]}"
    time_blocks: List[Dict[str, Any]] = []
    deferred_tasks: List[str] = []
    allocated_minutes = 0
    block_counter = 1

    try:
        cur_hour, cur_min = map(int, start_time_str.split(":"))
    except Exception:
        cur_hour, cur_min = 17, 0

    def add_minutes_to_time(h: int, m: int, delta: int) -> str:
        total = h * 60 + m + delta
        new_h = (total // 60) % 24
        new_m = total % 60
        return f"{new_h:02d}:{new_m:02d}"

    remaining_capacity = available_minutes

    for task in prioritized_tasks:
        if task.get("status") == "COMPLETED":
            continue

        est_time = task.get("estMinutes", 60)
        try:
            est_time = int(est_time)
        except (ValueError, TypeError):
            est_time = 60

        if remaining_capacity <= 0:
            deferred_tasks.append(task.get("taskId", task.get("id", "unknown")))
            continue

        task_chunk = min(est_time, 90, remaining_capacity)
        if task_chunk < 20 and remaining_capacity < 30 and len(time_blocks) > 0:
            deferred_tasks.append(task.get("taskId", task.get("id", "unknown")))
            continue

        start_time = f"{cur_hour:02d}:{cur_min:02d}"
        end_time = add_minutes_to_time(cur_hour, cur_min, task_chunk)

        time_blocks.append({
            "blockId": f"b{block_counter}",
            "taskId": task.get("taskId", task.get("id")),
            "title": task.get("title", "Study Block"),
            "startTime": start_time,
            "endTime": end_time,
            "durationMinutes": task_chunk,
            "actionItem": f"Deep focus on {task.get('category', 'Coursework')}: core objectives ({task_chunk}m)",
            "isRest": False,
            "difficulty": task.get("difficulty", 3),
            "tier": task.get("tier", "primary")
        })
        block_counter += 1
        allocated_minutes += task_chunk
        remaining_capacity -= task_chunk

        tot = cur_hour * 60 + cur_min + task_chunk
        cur_hour = (tot // 60) % 24
        cur_min = tot % 60

        # Insert 15m Cognitive Reset Break if capacity permits
        if remaining_capacity >= 30:
            rest_start = f"{cur_hour:02d}:{cur_min:02d}"
            rest_end = add_minutes_to_time(cur_hour, cur_min, 15)
            time_blocks.append({
                "blockId": f"b{block_counter}",
                "taskId": None,
                "title": "Cognitive Reset Break",
                "startTime": rest_start,
                "endTime": rest_end,
                "durationMinutes": 15,
                "actionItem": "Hydrate, rest eyes, and stretch; avoid digital screens",
                "isRest": True,
                "difficulty": 1,
                "tier": "rest"
            })
            block_counter += 1
            allocated_minutes += 15
            remaining_capacity -= 15

            tot = cur_hour * 60 + cur_min + 15
            cur_hour = (tot // 60) % 24
            cur_min = tot % 60

    summary_prefix = f"Adaptive Replan: {disruption_reason}. " if disruption_reason else ""
    deferred_msg = (
        f" Deferred {len(deferred_tasks)} task(s) beyond available capacity."
        if deferred_tasks
        else " All high-priority tasks successfully scheduled."
    )
    recovery_summary = (
        f"{summary_prefix}Allocated {allocated_minutes}m out of {available_minutes}m available."
        f"{deferred_msg} Enforces 90m deep work blocks & fatigue reset intervals."
    )

    return {
        "planId": plan_id,
        "targetDate": target_date,
        "totalAllocatedMinutes": allocated_minutes,
        "timeBlocks": time_blocks,
        "deferredTasks": deferred_tasks,
        "recoverySummary": recovery_summary
    }

# ==============================================================================
# FR-03: AMAZON BEDROCK ORCHESTRATION & CONTROLLED SCHEMA
# Models: us.anthropic.claude-3-5-sonnet-20241022-v2:0, anthropic.claude-3-5-sonnet-20240620-v1:0, amazon.nova-lite-v1:0
# ==============================================================================

def invoke_bedrock_planner(
    prioritized_tasks: List[Dict[str, Any]],
    available_minutes: int,
    target_date: str,
    energy_level: str = "NORMAL",
    disruption_reason: Optional[str] = None
) -> Dict[str, Any]:
    """
    Invokes Amazon Bedrock to synthesize cognitive load recovery schedule.
    Includes explicit error logging and automatic deterministic fallback.
    """
    if not BOTO3_AVAILABLE:
        logger.info("Bedrock skipped: boto3 not available in this runtime.")
        return deterministic_recovery_scheduler(
            prioritized_tasks, available_minutes, target_date, disruption_reason=disruption_reason
        )

    client = None
    try:
        session = boto3.Session()
        client = session.client("bedrock-runtime", region_name=AWS_REGION)
    except Exception as e:
        logger.warning(f"Could not create bedrock-runtime client: {e}. Falling back to deterministic scheduler.")
        return deterministic_recovery_scheduler(
            prioritized_tasks, available_minutes, target_date, disruption_reason=disruption_reason
        )

    tasks_json = json.dumps([{
        "taskId": t.get("taskId", t.get("id")),
        "title": t.get("title"),
        "category": t.get("category"),
        "deadline": t.get("deadline"),
        "priorityScore": float(t.get("priorityScore", 0)),
        "tier": t.get("tier"),
        "difficulty": int(t.get("difficulty", 3)),
        "estMinutes": int(t.get("estMinutes", 60))
    } for t in prioritized_tasks if t.get("status") != "COMPLETED"], indent=2)

    system_prompt = (
        "You are the Amazon Bedrock AI Study Recovery Coach. Synthesize a realistic, guilt-free study recovery plan.\n"
        "Rules:\n"
        "1. Strictly enforce max 90-minute deep work blocks.\n"
        "2. Insert 10-15 minute 'Cognitive Reset Break' (isRest: true, taskId: null) between intense blocks.\n"
        "3. High-difficulty tasks must be scheduled first when student capacity and energy are freshest.\n"
        f"4. Total schedule duration must not exceed {available_minutes} minutes.\n"
        "5. Defer tasks that exceed available capacity and list their taskIds in 'deferredTasks'.\n"
        "6. Return ONLY valid, parseable JSON matching this schema:\n"
        "{\n"
        '  "planId": "uuid-string",\n'
        '  "targetDate": "YYYY-MM-DD",\n'
        '  "totalAllocatedMinutes": 180,\n'
        '  "timeBlocks": [\n'
        '    {"blockId": "b1", "taskId": "string", "title": "string", "startTime": "HH:MM", "endTime": "HH:MM", "durationMinutes": 90, "actionItem": "string", "isRest": false}\n'
        "  ],\n"
        '  "deferredTasks": ["string"],\n'
        '  "recoverySummary": "string"\n'
        "}"
    )

    user_message = (
        f"Target Date: {target_date}\n"
        f"Available Study Minutes: {available_minutes}\n"
        f"Energy Level: {energy_level}\n"
        f"Disruption Notice: {disruption_reason or 'None'}\n\n"
        f"Prioritized Tasks:\n{tasks_json}\n\n"
        "Output the recovery plan JSON now."
    )

    # Candidate models to attempt in order of preference
    candidate_models = [
        BEDROCK_MODEL_ID,
        "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
        "anthropic.claude-3-5-sonnet-20240620-v1:0",
        "anthropic.claude-3-haiku-20240307-v1:0",
        "amazon.nova-lite-v1:0"
    ]
    # Deduplicate while preserving order
    seen = set()
    models_to_try = [m for m in candidate_models if not (m in seen or seen.add(m))]

    for model_id in models_to_try:
        try:
            logger.info(f"Attempting Bedrock schedule synthesis with model: {model_id}")
            payload = {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 2048,
                "temperature": 0.2,
                "system": system_prompt,
                "messages": [{"role": "user", "content": user_message}]
            }

            response = client.invoke_model(
                modelId=model_id,
                contentType="application/json",
                accept="application/json",
                body=json.dumps(payload)
            )

            response_body = json.loads(response.get("body").read().decode("utf-8"))
            raw_text = response_body.get("content", [{}])[0].get("text", "")

            json_match = re.search(r"\{.*\}", raw_text, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group(0))
                if "timeBlocks" in parsed and "recoverySummary" in parsed:
                    logger.info(f"Bedrock synthesis succeeded with model {model_id}.")
                    return parsed

        except Exception as e:
            logger.warning(f"Bedrock invocation failed on model {model_id}: {e}")
            # If not a model-not-found error, or if last model, break
            if "AccessDenied" in str(e) or "UnrecognizedClientException" in str(e):
                # Credentials issue, no need to retry all models
                break

    logger.info("Engaging deterministic greedy bin-packing fallback scheduler.")
    return deterministic_recovery_scheduler(
        prioritized_tasks, available_minutes, target_date, disruption_reason=disruption_reason
    )

# ==============================================================================
# DYNAMODB SINGLE-TABLE PERSISTENCE & LOCAL FALLBACK ENGINE
# ==============================================================================

class LocalStorageEngine:
    def __init__(self, file_path: str):
        self.file_path = file_path
        try:
            os.makedirs(os.path.dirname(os.path.abspath(file_path)), exist_ok=True)
            if not os.path.exists(file_path):
                self._write_store({})
        except Exception:
            pass

    def _read_store(self) -> Dict[str, Any]:
        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}

    def _write_store(self, data: Dict[str, Any]):
        try:
            with open(self.file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, cls=DecimalEncoder)
        except Exception as e:
            logger.warning(f"Local storage write failed: {e}")

    def put_item(self, item: Dict[str, Any]):
        store = self._read_store()
        key = f"{item['PK']}##{item['SK']}"
        store[key] = item
        self._write_store(store)

    def get_item(self, pk: str, sk: str) -> Optional[Dict[str, Any]]:
        store = self._read_store()
        return store.get(f"{pk}##{sk}")

    def query_by_pk(self, pk: str, sk_prefix: str = "") -> List[Dict[str, Any]]:
        store = self._read_store()
        results = []
        for k, item in store.items():
            if item.get("PK") == pk:
                if not sk_prefix or str(item.get("SK", "")).startswith(sk_prefix):
                    results.append(item)
        return results

    def update_item(self, pk: str, sk: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        store = self._read_store()
        key = f"{pk}##{sk}"
        if key in store:
            store[key].update(updates)
            self._write_store(store)
            return store[key]
        return None

local_db = LocalStorageEngine(LOCAL_STORAGE_FILE)

def get_dynamo_table():
    """Returns the DynamoDB Table resource if AWS credentials and service are active."""
    if not BOTO3_AVAILABLE:
        return None
    try:
        dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
        table = dynamodb.Table(DYNAMODB_TABLE_NAME)
        return table
    except Exception as e:
        logger.warning(f"DynamoDB initialization failed: {e}")
        return None

# Unified Storage Interface
def db_put_item(item: Dict[str, Any]):
    """Puts item into DynamoDB as source of truth, with local fallback for local development."""
    table = get_dynamo_table()
    if table:
        try:
            dynamo_formatted = to_dynamo_item(item)
            table.put_item(Item=dynamo_formatted)
            logger.info(f"Saved item to DynamoDB: {item.get('PK')} / {item.get('SK')}")
            return
        except Exception as e:
            logger.error(f"Failed to put_item in DynamoDB: {e}", exc_info=True)
            if IS_LAMBDA_ENV:
                raise e

    if not IS_LAMBDA_ENV:
        local_db.put_item(item)

def db_get_item(pk: str, sk: str) -> Optional[Dict[str, Any]]:
    """Gets an item from DynamoDB as source of truth, with local fallback."""
    table = get_dynamo_table()
    if table:
        try:
            resp = table.get_item(Key={"PK": pk, "SK": sk})
            item = resp.get("Item")
            if item:
                return from_dynamo_item(item)
        except Exception as e:
            logger.error(f"Failed to get_item from DynamoDB: {e}", exc_info=True)
            if IS_LAMBDA_ENV:
                raise e

    if not IS_LAMBDA_ENV:
        return local_db.get_item(pk, sk)
    return None

def db_query(pk: str, sk_prefix: str = "") -> List[Dict[str, Any]]:
    """Queries items by PK and optional SK prefix from DynamoDB as source of truth."""
    table = get_dynamo_table()
    if table:
        try:
            if sk_prefix:
                resp = table.query(
                    KeyConditionExpression="PK = :pk AND begins_with(SK, :sk)",
                    ExpressionAttributeValues={":pk": pk, ":sk": sk_prefix}
                )
            else:
                resp = table.query(
                    KeyConditionExpression="PK = :pk",
                    ExpressionAttributeValues={":pk": pk}
                )
            items = resp.get("Items", [])
            return [from_dynamo_item(i) for i in items]
        except Exception as e:
            logger.error(f"Failed to query DynamoDB: {e}", exc_info=True)
            if IS_LAMBDA_ENV:
                raise e

    if not IS_LAMBDA_ENV:
        return local_db.query_by_pk(pk, sk_prefix)
    return []

def db_update_task_status(pk: str, sk: str, new_status: str, logged_minutes: int, updated_at: str):
    """Updates a task's status and logged minutes in DynamoDB as source of truth."""
    table = get_dynamo_table()
    if table:
        try:
            table.update_item(
                Key={"PK": pk, "SK": sk},
                UpdateExpression="SET #st = :st, loggedMinutes = :lm, updatedAt = :ua",
                ExpressionAttributeNames={"#st": "status"},
                ExpressionAttributeValues={
                    ":st": new_status,
                    ":lm": logged_minutes,
                    ":ua": updated_at
                }
            )
            logger.info(f"Updated task in DynamoDB: {pk} / {sk} -> {new_status}")
            return
        except Exception as e:
            logger.error(f"Failed to update task in DynamoDB: {e}", exc_info=True)
            if IS_LAMBDA_ENV:
                raise e

    if not IS_LAMBDA_ENV:
        local_db.update_item(pk, sk, {
            "status": new_status,
            "loggedMinutes": logged_minutes,
            "updatedAt": updated_at
        })

def get_existing_plan_versions(user_id: str, target_date: str) -> List[Dict[str, Any]]:
    """Retrieves all existing plans for the target date, sorted descending by version."""
    plans = db_query(f"USER#{user_id}", f"PLAN#{target_date}#v")
    plans.sort(key=lambda p: int(p.get("version", 1)), reverse=True)
    return plans

def seed_default_tasks_if_empty(user_id: str = "student-001"):
    """Seeds initial tasks for development if data store is completely empty."""
    if IS_LAMBDA_ENV:
        return
    existing = local_db.query_by_pk(f"USER#{user_id}", "TASK#")
    if not existing:
        now = datetime.datetime.now(datetime.timezone.utc)
        tomorrow_iso = (now + datetime.timedelta(days=1)).strftime("%Y-%m-%dT18:00:00Z")
        in_2_days_iso = (now + datetime.timedelta(days=2)).strftime("%Y-%m-%dT23:59:59Z")
        in_4_days_iso = (now + datetime.timedelta(days=4)).strftime("%Y-%m-%dT23:59:59Z")

        seed_tasks = [
            {
                "PK": f"USER#{user_id}",
                "SK": "TASK#task-uuid-1",
                "taskId": "task-uuid-1",
                "title": "Binary Search Trees & LeetCode Tree Traversal",
                "category": "LeetCode / DSA",
                "deadline": tomorrow_iso,
                "importance": 3,
                "difficulty": 4,
                "estMinutes": 90,
                "status": "PENDING",
                "loggedMinutes": 0,
                "createdAt": now.isoformat()
            },
            {
                "PK": f"USER#{user_id}",
                "SK": "TASK#task-uuid-2",
                "taskId": "task-uuid-2",
                "title": "DBMS Normalization (3NF & BCNF Proofs)",
                "category": "College Exam",
                "deadline": in_2_days_iso,
                "importance": 2,
                "difficulty": 3,
                "estMinutes": 60,
                "status": "PENDING",
                "loggedMinutes": 0,
                "createdAt": now.isoformat()
            },
            {
                "PK": f"USER#{user_id}",
                "SK": "TASK#task-uuid-3",
                "taskId": "task-uuid-3",
                "title": "Web Architecture & Cloud API Gateway Lab",
                "category": "Project / Lab",
                "deadline": in_4_days_iso,
                "importance": 1,
                "difficulty": 2,
                "estMinutes": 45,
                "status": "PENDING",
                "loggedMinutes": 0,
                "createdAt": now.isoformat()
            }
        ]
        for t in seed_tasks:
            local_db.put_item(t)

seed_default_tasks_if_empty()

# ==============================================================================
# API GATEWAY HTTP API V2 ROUTER & HANDLER
# ==============================================================================

def api_response(status_code: int, body_data: Any) -> Dict[str, Any]:
    """Generates clean CORS-enabled HTTP response for API Gateway."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token"
        },
        "body": json.dumps(body_data, cls=DecimalEncoder)
    }

def lambda_handler(event: Dict[str, Any], context: Any = None) -> Dict[str, Any]:
    """
    Main Lambda entry point matching API Gateway REST Specifications:
    - OPTIONS /*
    - POST  /tasks
    - GET   /tasks
    - PATCH /tasks/{id}
    - POST  /plan/generate (Generates V1)
    - POST  /plan/replan   (Bumps to V2, V3...)
    - GET   /plan          (Retrieves latest persisted plan)
    """
    http_method = (
        event.get("httpMethod") or
        event.get("requestContext", {}).get("http", {}).get("method") or
        "GET"
    ).upper()

    raw_path = (
        event.get("path") or
        event.get("rawPath") or
        event.get("requestContext", {}).get("http", {}).get("path") or
        "/"
    )

    # 1. Preflight CORS
    if http_method == "OPTIONS":
        return api_response(200, {"message": "CORS OK"})

    query_params = event.get("queryStringParameters") or {}
    body_str = event.get("body") or "{}"
    try:
        body = json.loads(body_str) if isinstance(body_str, str) else body_str
    except Exception:
        body = {}

    logger.info(f"Handling {http_method} {raw_path}")

    # --------------------------------------------------------------------------
    # ROUTE: POST /tasks (FR-01: Task Ingestion)
    # --------------------------------------------------------------------------
    if http_method == "POST" and raw_path.rstrip("/").endswith("/tasks"):
        user_id = body.get("userId", "student-001")
        title = body.get("title")
        if not title:
            return api_response(400, {"error": "Title is required"})

        task_id = body.get("taskId") or f"task-{uuid.uuid4().hex[:8]}"
        task_item = {
            "PK": f"USER#{user_id}",
            "SK": f"TASK#{task_id}",
            "taskId": task_id,
            "userId": user_id,
            "title": title,
            "category": body.get("category", "General Study"),
            "deadline": body.get("deadline", (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=2)).isoformat()),
            "importance": int(body.get("importance", 2)),
            "difficulty": int(body.get("difficulty", 3)),
            "estMinutes": int(body.get("estMinutes", 60)),
            "status": "PENDING",
            "loggedMinutes": 0,
            "createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }

        # Save to DynamoDB as source of truth
        db_put_item(task_item)

        # Attach computed priority metrics for response
        p_info = calculate_priority(task_item)
        task_item.update(p_info)

        return api_response(201, {
            "taskId": task_id,
            "status": "PENDING",
            "task": task_item
        })

    # --------------------------------------------------------------------------
    # ROUTE: GET /tasks
    # --------------------------------------------------------------------------
    if http_method == "GET" and raw_path.rstrip("/").endswith("/tasks"):
        user_id = query_params.get("userId", "student-001")
        status_filter = query_params.get("status", "all")

        tasks = db_query(f"USER#{user_id}", "TASK#")
        enriched_tasks = prioritize_tasks(tasks)

        if status_filter != "all":
            enriched_tasks = [t for t in enriched_tasks if t.get("status", "").upper() == status_filter.upper()]

        return api_response(200, {"tasks": enriched_tasks})

    # --------------------------------------------------------------------------
    # ROUTE: PATCH /tasks/{id} (FR-04: Dynamic Progress Tracking)
    # --------------------------------------------------------------------------
    if http_method == "PATCH" and "/tasks/" in raw_path:
        task_id = raw_path.split("/tasks/")[-1].strip("/")
        user_id = body.get("userId", "student-001")
        new_status = body.get("status", "COMPLETED").upper()
        logged_minutes = int(body.get("loggedMinutes", 0))
        updated_at = datetime.datetime.now(datetime.timezone.utc).isoformat()

        db_update_task_status(
            f"USER#{user_id}",
            f"TASK#{task_id}",
            new_status,
            logged_minutes,
            updated_at
        )

        return api_response(200, {
            "taskId": task_id,
            "updatedStatus": new_status,
            "loggedMinutes": logged_minutes
        })

    # --------------------------------------------------------------------------
    # ROUTE: POST /plan/generate (FR-03: Bedrock AI Recovery Plan V1)
    # --------------------------------------------------------------------------
    if http_method == "POST" and raw_path.rstrip("/").endswith("/plan/generate"):
        user_id = body.get("userId", "student-001")
        target_date = body.get("date", datetime.datetime.now().strftime("%Y-%m-%d"))
        available_minutes = int(body.get("availableMinutes", 180))
        energy_level = body.get("energyLevel", "NORMAL")

        # 1. Fetch user tasks from DynamoDB source of truth
        tasks = db_query(f"USER#{user_id}", "TASK#")
        prioritized = prioritize_tasks(tasks)

        # 2. Invoke Bedrock planner with fallback
        plan = invoke_bedrock_planner(
            prioritized_tasks=prioritized,
            available_minutes=available_minutes,
            target_date=target_date,
            energy_level=energy_level
        )

        # 3. Plan versioning: Initial generation is strictly V1
        plan_version = 1
        plan_record = {
            "PK": f"USER#{user_id}",
            "SK": f"PLAN#{target_date}#v{plan_version}",
            "version": plan_version,
            "planId": plan.get("planId") or f"plan-{uuid.uuid4().hex[:8]}",
            "targetDate": target_date,
            "totalAllocatedMinutes": int(plan.get("totalAllocatedMinutes", available_minutes)),
            "timeBlocks": plan.get("timeBlocks", []),
            "deferredTasks": plan.get("deferredTasks", []),
            "recoverySummary": plan.get("recoverySummary", ""),
            "isReplan": False,
            "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }

        # 4. Persist to DynamoDB
        db_put_item(plan_record)

        return api_response(200, plan_record)

    # --------------------------------------------------------------------------
    # ROUTE: POST /plan/replan (FR-05: Adaptive Replanning Loop -> V2, V3...)
    # --------------------------------------------------------------------------
    if http_method == "POST" and raw_path.rstrip("/").endswith("/plan/replan"):
        user_id = body.get("userId", "student-001")
        target_date = body.get("date", datetime.datetime.now().strftime("%Y-%m-%d"))
        missed_task_id = body.get("missedTaskId")
        remaining_minutes = int(body.get("remainingAvailableMinutes", 120))
        disruption_reason = body.get("disruptionReason", "Missed scheduled session / time constraint changed")
        updated_at = datetime.datetime.now(datetime.timezone.utc).isoformat()

        # If missed task specified, update task status in DynamoDB
        if missed_task_id:
            db_update_task_status(
                f"USER#{user_id}",
                f"TASK#{missed_task_id}",
                "MISSED",
                0,
                updated_at
            )

        # Fetch all user tasks from DynamoDB and reprioritize
        tasks = db_query(f"USER#{user_id}", "TASK#")
        prioritized = prioritize_tasks(tasks)

        # Synthesize revised recovery plan
        revised_plan = invoke_bedrock_planner(
            prioritized_tasks=prioritized,
            available_minutes=remaining_minutes,
            target_date=target_date,
            disruption_reason=disruption_reason
        )

        # Plan versioning: Query existing plans to guarantee V2, V3 and prevent overwrites
        existing_plans = get_existing_plan_versions(user_id, target_date)
        highest_v = int(existing_plans[0].get("version", 1)) if existing_plans else 1
        requested_v = int(body.get("currentVersion", 1))
        plan_version = max(highest_v, requested_v) + 1

        plan_record = {
            "PK": f"USER#{user_id}",
            "SK": f"PLAN#{target_date}#v{plan_version}",
            "version": plan_version,
            "planId": revised_plan.get("planId") or f"plan-{uuid.uuid4().hex[:8]}",
            "targetDate": target_date,
            "totalAllocatedMinutes": int(revised_plan.get("totalAllocatedMinutes", remaining_minutes)),
            "timeBlocks": revised_plan.get("timeBlocks", []),
            "deferredTasks": revised_plan.get("deferredTasks", []),
            "recoverySummary": revised_plan.get("recoverySummary", ""),
            "isReplan": True,
            "disruptionReason": disruption_reason,
            "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }

        # Persist versioned plan to DynamoDB
        db_put_item(plan_record)

        return api_response(200, plan_record)

    # --------------------------------------------------------------------------
    # ROUTE: GET /plan (Retrieve latest persisted recovery plan from DynamoDB)
    # --------------------------------------------------------------------------
    if http_method == "GET" and raw_path.rstrip("/").endswith("/plan"):
        user_id = query_params.get("userId", "student-001")
        target_date = query_params.get("date", datetime.datetime.now().strftime("%Y-%m-%d"))

        existing_plans = get_existing_plan_versions(user_id, target_date)
        if not existing_plans:
            return api_response(404, {"error": "No plan found for specified date", "date": target_date})

        latest_plan = existing_plans[0]
        return api_response(200, {
            "plan": latest_plan,
            "availableVersions": [int(p.get("version", 1)) for p in existing_plans]
        })

    return api_response(404, {"error": "Not Found", "path": raw_path, "method": http_method})
