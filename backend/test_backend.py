"""
Unit tests for AI Study Recovery Coach Backend & Priority Engine.
"""

import unittest
import json
import datetime
import sys
import os

import importlib.util
app_path = os.path.join(os.path.dirname(__file__), "lambda", "app.py")
spec = importlib.util.spec_from_file_location("lambda_app", app_path)
lambda_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lambda_module)

calculate_priority = lambda_module.calculate_priority
prioritize_tasks = lambda_module.prioritize_tasks
deterministic_recovery_scheduler = lambda_module.deterministic_recovery_scheduler
lambda_handler = lambda_module.lambda_handler

class TestPriorityEngine(unittest.TestCase):
    def test_priority_math_formula(self):
        ref_time = datetime.datetime(2026, 9, 19, 12, 0, 0, tzinfo=datetime.timezone.utc)
        # Due in exactly 24 hours
        deadline = datetime.datetime(2026, 9, 20, 12, 0, 0, tzinfo=datetime.timezone.utc).isoformat()
        
        task = {
            "title": "Binary Search Trees",
            "deadline": deadline,
            "importance": 3, # High -> 100
            "difficulty": 4, # Level 4 -> 80
            "estMinutes": 90
        }
        
        # Expected Urgency: 100 - (24 * 1.25) = 70.0
        # Expected Importance: 100.0
        # Expected Difficulty: 4 * 20 = 80.0
        # Expected Composite: 0.45*70 + 0.35*100 + 0.20*80 = 31.5 + 35.0 + 16.0 = 82.5
        result = calculate_priority(task, ref_time)
        self.assertEqual(result["urgencyScore"], 70.0)
        self.assertEqual(result["importanceWeight"], 100.0)
        self.assertEqual(result["difficultyFactor"], 80.0)
        self.assertEqual(result["priorityScore"], 82.5)
        self.assertEqual(result["tier"], "critical")

    def test_cognitive_load_rules_scheduler(self):
        tasks = [
            {"id": "t1", "title": "Hard DSA Block", "estMinutes": 120, "importance": 3, "difficulty": 5, "priorityScore": 90.0, "tier": "critical"},
            {"id": "t2", "title": "DBMS Review", "estMinutes": 60, "importance": 2, "difficulty": 3, "priorityScore": 65.0, "tier": "primary"},
            {"id": "t3", "title": "CSS Styling", "estMinutes": 45, "importance": 1, "difficulty": 1, "priorityScore": 30.0, "tier": "deferrable"}
        ]
        
        # 180 minutes capacity
        plan = deterministic_recovery_scheduler(tasks, available_minutes=180, target_date="2026-09-19")
        blocks = plan["timeBlocks"]
        
        # Check rule 1: max 90m deep work block (t1 capped at 90)
        first_work_block = blocks[0]
        self.assertLessEqual(first_work_block["durationMinutes"], 90)
        
        # Check rule 2: cognitive reset break inserted
        rest_blocks = [b for b in blocks if b.get("isRest")]
        self.assertTrue(len(rest_blocks) >= 1)
        self.assertEqual(rest_blocks[0]["title"], "Cognitive Reset Break")
        
        # Check rule 3: total allocated does not exceed available minutes
        self.assertLessEqual(plan["totalAllocatedMinutes"], 180)

    def test_lambda_endpoints_end_to_end(self):
        user_id = f"test-user-{int(datetime.datetime.now().timestamp())}"
        
        # 1. POST /tasks
        post_event = {
            "httpMethod": "POST",
            "path": "/tasks",
            "body": json.dumps({
                "userId": user_id,
                "title": "OS Virtual Memory Paging",
                "category": "College Exam",
                "importance": 3,
                "difficulty": 4,
                "estMinutes": 75
            })
        }
        resp = lambda_handler(post_event)
        self.assertEqual(resp["statusCode"], 201)
        task_data = json.loads(resp["body"])
        task_id = task_data["taskId"]
        self.assertIsNotNone(task_id)

        # 2. GET /tasks
        get_event = {
            "httpMethod": "GET",
            "path": "/tasks",
            "queryStringParameters": {"userId": user_id}
        }
        resp2 = lambda_handler(get_event)
        self.assertEqual(resp2["statusCode"], 200)
        tasks_list = json.loads(resp2["body"])["tasks"]
        self.assertTrue(any(t["taskId"] == task_id for t in tasks_list))

        # 3. POST /plan/generate
        gen_event = {
            "httpMethod": "POST",
            "path": "/plan/generate",
            "body": json.dumps({
                "userId": user_id,
                "date": "2026-09-19",
                "availableMinutes": 150
            })
        }
        resp3 = lambda_handler(gen_event)
        self.assertEqual(resp3["statusCode"], 200)
        plan_data = json.loads(resp3["body"])
        self.assertEqual(plan_data["version"], 1)
        self.assertTrue(len(plan_data["timeBlocks"]) > 0)

        # 4. POST /plan/replan (Disruption triggered!)
        replan_event = {
            "httpMethod": "POST",
            "path": "/plan/replan",
            "body": json.dumps({
                "userId": user_id,
                "date": "2026-09-19",
                "missedTaskId": task_id,
                "remainingAvailableMinutes": 60,
                "currentVersion": 1,
                "disruptionReason": "Lab report ran 1 hour overtime"
            })
        }
        resp4 = lambda_handler(replan_event)
        self.assertEqual(resp4["statusCode"], 200)
        replan_data = json.loads(resp4["body"])
        self.assertEqual(replan_data["version"], 2)
        self.assertTrue(replan_data["isReplan"])
        self.assertIn("Lab report ran 1 hour overtime", replan_data["recoverySummary"])

        # 5. GET /plan (Fetch latest persisted recovery plan version 2)
        get_plan_event = {
            "httpMethod": "GET",
            "path": "/plan",
            "queryStringParameters": {
                "userId": user_id,
                "date": "2026-09-19"
            }
        }
        resp5 = lambda_handler(get_plan_event)
        self.assertEqual(resp5["statusCode"], 200)
        plan_query_data = json.loads(resp5["body"])
        self.assertIn("plan", plan_query_data)
        self.assertEqual(plan_query_data["plan"]["version"], 2)
        self.assertIn(2, plan_query_data.get("availableVersions", []))

if __name__ == "__main__":
    unittest.main()
