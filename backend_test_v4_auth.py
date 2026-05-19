#!/usr/bin/env python3
"""
ChemistShop v4 Auth Backend Test Suite
Tests 3 new auth-focused endpoint groups: Unified Auth, Role Protection, Legacy Admin Login
"""

import requests
import json
import sys
import time

# Read base URL from environment
BASE_URL = "https://chemist-refresh.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@chemistshop.top"
ADMIN_PASSWORD = "admin123"

# Global storage
user_email = None
user_password = "pass1234"
user_token = None
admin_token = None

test_results = {
    "unified_auth": {"passed": 0, "failed": 0, "details": []},
    "role_protection": {"passed": 0, "failed": 0, "details": []},
    "legacy_admin_login": {"passed": 0, "failed": 0, "details": []},
}

def log_result(group, test_name, passed, message=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {test_name}")
    if message:
        print(f"  → {message}")
    
    test_results[group]["passed" if passed else "failed"] += 1
    test_results[group]["details"].append({
        "test": test_name,
        "passed": passed,
        "message": message
    })

def test_unified_auth():
    """Test A: Unified Auth Endpoints"""
    global user_email, user_password, user_token
    print("\n=== A) UNIFIED AUTH ===")
    
    # Generate unique email with timestamp
    timestamp = int(time.time())
    user_email = f"testuser{timestamp}@example.com"
    
    # A1: POST /api/auth/signup with valid data -> 200
    try:
        resp = requests.post(f"{BASE_URL}/auth/signup", json={
            "name": "Test Person",
            "email": user_email,
            "password": user_password,
            "phone": "9876543210"
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if (data.get("ok") == True and 
                data.get("token") and 
                data.get("user", {}).get("role") == "user" and
                data.get("user", {}).get("email") == user_email):
                user_token = data["token"]
                log_result("unified_auth", "A1: POST /api/auth/signup (valid data → 200)", True, 
                         f"User created with role=user, token received")
            else:
                log_result("unified_auth", "A1: POST /api/auth/signup (valid data → 200)", False, 
                         f"Invalid response structure: {data}")
        else:
            log_result("unified_auth", "A1: POST /api/auth/signup (valid data → 200)", False, 
                     f"Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result("unified_auth", "A1: POST /api/auth/signup (valid data → 200)", False, str(e))
    
    # A2: Duplicate signup -> 409
    try:
        resp = requests.post(f"{BASE_URL}/auth/signup", json={
            "name": "Test Person",
            "email": user_email,
            "password": user_password,
            "phone": "9876543210"
        }, timeout=10)
        
        if resp.status_code == 409:
            data = resp.json()
            if data.get("ok") == False and "already" in data.get("error", "").lower():
                log_result("unified_auth", "A2: POST /api/auth/signup (duplicate → 409)", True, 
                         f"Correctly rejected: {data.get('error')}")
            else:
                log_result("unified_auth", "A2: POST /api/auth/signup (duplicate → 409)", False, 
                         f"Expected error with 'already', got: {data}")
        else:
            log_result("unified_auth", "A2: POST /api/auth/signup (duplicate → 409)", False, 
                     f"Expected 409, got {resp.status_code}")
    except Exception as e:
        log_result("unified_auth", "A2: POST /api/auth/signup (duplicate → 409)", False, str(e))
    
    # A3: Invalid email format -> 400
    try:
        resp = requests.post(f"{BASE_URL}/auth/signup", json={
            "name": "Bad Email",
            "email": "badmail",
            "password": "pass1234",
            "phone": "9876543210"
        }, timeout=10)
        
        if resp.status_code == 400:
            data = resp.json()
            if data.get("ok") == False:
                log_result("unified_auth", "A3: POST /api/auth/signup (invalid email → 400)", True, 
                         f"Correctly rejected: {data.get('error')}")
            else:
                log_result("unified_auth", "A3: POST /api/auth/signup (invalid email → 400)", False, 
                         f"Expected ok:false, got: {data}")
        else:
            log_result("unified_auth", "A3: POST /api/auth/signup (invalid email → 400)", False, 
                     f"Expected 400, got {resp.status_code}")
    except Exception as e:
        log_result("unified_auth", "A3: POST /api/auth/signup (invalid email → 400)", False, str(e))
    
    # A4: Password < 6 chars -> 400
    try:
        resp = requests.post(f"{BASE_URL}/auth/signup", json={
            "name": "Short Pass",
            "email": f"short{timestamp}@example.com",
            "password": "short",
            "phone": "9876543210"
        }, timeout=10)
        
        if resp.status_code == 400:
            data = resp.json()
            if data.get("ok") == False and "6" in data.get("error", ""):
                log_result("unified_auth", "A4: POST /api/auth/signup (password < 6 → 400)", True, 
                         f"Correctly rejected: {data.get('error')}")
            else:
                log_result("unified_auth", "A4: POST /api/auth/signup (password < 6 → 400)", False, 
                         f"Expected error mentioning '6', got: {data}")
        else:
            log_result("unified_auth", "A4: POST /api/auth/signup (password < 6 → 400)", False, 
                     f"Expected 400, got {resp.status_code}")
    except Exception as e:
        log_result("unified_auth", "A4: POST /api/auth/signup (password < 6 → 400)", False, str(e))
    
    # A5: POST /api/auth/login with correct password -> 200; wrong password -> 401
    # A5a: Correct password
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={
            "email": user_email,
            "password": user_password
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if (data.get("ok") == True and 
                data.get("token") and 
                data.get("user", {}).get("role") == "user"):
                user_token = data["token"]
                log_result("unified_auth", "A5a: POST /api/auth/login (correct password → 200)", True, 
                         f"Login successful, role=user")
            else:
                log_result("unified_auth", "A5a: POST /api/auth/login (correct password → 200)", False, 
                         f"Invalid response: {data}")
        else:
            log_result("unified_auth", "A5a: POST /api/auth/login (correct password → 200)", False, 
                     f"Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result("unified_auth", "A5a: POST /api/auth/login (correct password → 200)", False, str(e))
    
    # A5b: Wrong password
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={
            "email": user_email,
            "password": "wrongpassword"
        }, timeout=10)
        
        if resp.status_code == 401:
            data = resp.json()
            if data.get("ok") == False:
                log_result("unified_auth", "A5b: POST /api/auth/login (wrong password → 401)", True, 
                         f"Correctly rejected: {data.get('error')}")
            else:
                log_result("unified_auth", "A5b: POST /api/auth/login (wrong password → 401)", False, 
                         f"Expected ok:false, got: {data}")
        else:
            log_result("unified_auth", "A5b: POST /api/auth/login (wrong password → 401)", False, 
                     f"Expected 401, got {resp.status_code}")
    except Exception as e:
        log_result("unified_auth", "A5b: POST /api/auth/login (wrong password → 401)", False, str(e))
    
    # A6: GET /api/auth/me with valid Bearer -> 200; no header -> 401; invalid token -> 401
    # A6a: Valid Bearer
    try:
        resp = requests.get(f"{BASE_URL}/auth/me", headers={
            "Authorization": f"Bearer {user_token}"
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if (data.get("ok") == True and 
                data.get("user", {}).get("role") == "user" and
                data.get("user", {}).get("email") == user_email):
                log_result("unified_auth", "A6a: GET /api/auth/me (valid Bearer → 200)", True, 
                         f"User info retrieved: {data['user'].get('email')}")
            else:
                log_result("unified_auth", "A6a: GET /api/auth/me (valid Bearer → 200)", False, 
                         f"Invalid response: {data}")
        else:
            log_result("unified_auth", "A6a: GET /api/auth/me (valid Bearer → 200)", False, 
                     f"Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result("unified_auth", "A6a: GET /api/auth/me (valid Bearer → 200)", False, str(e))
    
    # A6b: No header
    try:
        resp = requests.get(f"{BASE_URL}/auth/me", timeout=10)
        
        if resp.status_code == 401:
            log_result("unified_auth", "A6b: GET /api/auth/me (no header → 401)", True, 
                     "Correctly rejected")
        else:
            log_result("unified_auth", "A6b: GET /api/auth/me (no header → 401)", False, 
                     f"Expected 401, got {resp.status_code}")
    except Exception as e:
        log_result("unified_auth", "A6b: GET /api/auth/me (no header → 401)", False, str(e))
    
    # A6c: Invalid token
    try:
        resp = requests.get(f"{BASE_URL}/auth/me", headers={
            "Authorization": "Bearer invalid-token-xyz"
        }, timeout=10)
        
        if resp.status_code == 401:
            log_result("unified_auth", "A6c: GET /api/auth/me (invalid token → 401)", True, 
                     "Correctly rejected")
        else:
            log_result("unified_auth", "A6c: GET /api/auth/me (invalid token → 401)", False, 
                     f"Expected 401, got {resp.status_code}")
    except Exception as e:
        log_result("unified_auth", "A6c: GET /api/auth/me (invalid token → 401)", False, str(e))
    
    # A7: PUT /api/auth/password with Bearer, body {current, next} -> 200
    new_password = "newpass1"
    try:
        resp = requests.put(f"{BASE_URL}/auth/password", 
            headers={"Authorization": f"Bearer {user_token}"},
            json={"current": user_password, "next": new_password},
            timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") == True:
                log_result("unified_auth", "A7: PUT /api/auth/password (change password → 200)", True, 
                         "Password changed successfully")
            else:
                log_result("unified_auth", "A7: PUT /api/auth/password (change password → 200)", False, 
                         f"Expected ok:true, got: {data}")
        else:
            log_result("unified_auth", "A7: PUT /api/auth/password (change password → 200)", False, 
                     f"Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result("unified_auth", "A7: PUT /api/auth/password (change password → 200)", False, str(e))
    
    # A8: Verify old password fails, new password succeeds
    # A8a: Old password should fail
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={
            "email": user_email,
            "password": user_password
        }, timeout=10)
        
        if resp.status_code == 401:
            log_result("unified_auth", "A8a: POST /api/auth/login (old password → 401)", True, 
                     "Old password correctly rejected")
        else:
            log_result("unified_auth", "A8a: POST /api/auth/login (old password → 401)", False, 
                     f"Expected 401, got {resp.status_code}")
    except Exception as e:
        log_result("unified_auth", "A8a: POST /api/auth/login (old password → 401)", False, str(e))
    
    # A8b: New password should succeed
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={
            "email": user_email,
            "password": new_password
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") == True and data.get("token"):
                user_token = data["token"]
                user_password = new_password  # Update for future tests
                log_result("unified_auth", "A8b: POST /api/auth/login (new password → 200)", True, 
                         "New password works correctly")
            else:
                log_result("unified_auth", "A8b: POST /api/auth/login (new password → 200)", False, 
                         f"Invalid response: {data}")
        else:
            log_result("unified_auth", "A8b: POST /api/auth/login (new password → 200)", False, 
                     f"Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result("unified_auth", "A8b: POST /api/auth/login (new password → 200)", False, str(e))

def test_role_protection():
    """Test B: Role Protection"""
    global admin_token, user_token
    print("\n=== B) ROLE PROTECTION ===")
    
    # B1: Login as admin -> token has role admin
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if (data.get("ok") == True and 
                data.get("token") and 
                data.get("user", {}).get("role") == "admin"):
                admin_token = data["token"]
                log_result("role_protection", "B1: POST /api/auth/login (admin → role=admin)", True, 
                         f"Admin login successful, role=admin")
            else:
                log_result("role_protection", "B1: POST /api/auth/login (admin → role=admin)", False, 
                         f"Expected role=admin, got: {data}")
        else:
            log_result("role_protection", "B1: POST /api/auth/login (admin → role=admin)", False, 
                     f"Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result("role_protection", "B1: POST /api/auth/login (admin → role=admin)", False, str(e))
    
    # B2: GET /api/admin/me with admin Bearer -> 200
    try:
        resp = requests.get(f"{BASE_URL}/admin/me", headers={
            "Authorization": f"Bearer {admin_token}"
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if (data.get("ok") == True and 
                data.get("user", {}).get("role") == "admin"):
                log_result("role_protection", "B2: GET /api/admin/me (admin Bearer → 200)", True, 
                         f"Admin access granted")
            else:
                log_result("role_protection", "B2: GET /api/admin/me (admin Bearer → 200)", False, 
                         f"Invalid response: {data}")
        else:
            log_result("role_protection", "B2: GET /api/admin/me (admin Bearer → 200)", False, 
                     f"Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result("role_protection", "B2: GET /api/admin/me (admin Bearer → 200)", False, str(e))
    
    # B3: GET /api/admin/me with USER Bearer -> 403 (error mentions 'Admin')
    try:
        resp = requests.get(f"{BASE_URL}/admin/me", headers={
            "Authorization": f"Bearer {user_token}"
        }, timeout=10)
        
        if resp.status_code == 403:
            data = resp.json()
            if (data.get("ok") == False and 
                "admin" in data.get("error", "").lower()):
                log_result("role_protection", "B3: GET /api/admin/me (user Bearer → 403)", True, 
                         f"Correctly rejected: {data.get('error')}")
            else:
                log_result("role_protection", "B3: GET /api/admin/me (user Bearer → 403)", False, 
                         f"Expected error mentioning 'admin', got: {data}")
        else:
            log_result("role_protection", "B3: GET /api/admin/me (user Bearer → 403)", False, 
                     f"Expected 403, got {resp.status_code}")
    except Exception as e:
        log_result("role_protection", "B3: GET /api/admin/me (user Bearer → 403)", False, str(e))
    
    # B4: GET /api/admin/me with NO header -> 401
    try:
        resp = requests.get(f"{BASE_URL}/admin/me", timeout=10)
        
        if resp.status_code == 401:
            log_result("role_protection", "B4: GET /api/admin/me (no header → 401)", True, 
                     "Correctly rejected")
        else:
            log_result("role_protection", "B4: GET /api/admin/me (no header → 401)", False, 
                     f"Expected 401, got {resp.status_code}")
    except Exception as e:
        log_result("role_protection", "B4: GET /api/admin/me (no header → 401)", False, str(e))
    
    # B5: GET /api/admin/me with garbage Bearer 'xyz.abc' -> 401
    try:
        resp = requests.get(f"{BASE_URL}/admin/me", headers={
            "Authorization": "Bearer xyz.abc"
        }, timeout=10)
        
        if resp.status_code == 401:
            log_result("role_protection", "B5: GET /api/admin/me (garbage Bearer → 401)", True, 
                     "Correctly rejected")
        else:
            log_result("role_protection", "B5: GET /api/admin/me (garbage Bearer → 401)", False, 
                     f"Expected 401, got {resp.status_code}")
    except Exception as e:
        log_result("role_protection", "B5: GET /api/admin/me (garbage Bearer → 401)", False, str(e))

def test_legacy_admin_login():
    """Test C: Legacy POST /api/admin/login"""
    global user_email, user_password
    print("\n=== C) LEGACY /api/admin/login ===")
    
    # C1: Admin creds -> 200
    try:
        resp = requests.post(f"{BASE_URL}/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if (data.get("ok") == True and 
                data.get("token") and 
                data.get("user", {}).get("role") == "admin"):
                log_result("legacy_admin_login", "C1: POST /api/admin/login (admin creds → 200)", True, 
                         f"Admin login successful")
            else:
                log_result("legacy_admin_login", "C1: POST /api/admin/login (admin creds → 200)", False, 
                         f"Invalid response: {data}")
        else:
            log_result("legacy_admin_login", "C1: POST /api/admin/login (admin creds → 200)", False, 
                     f"Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result("legacy_admin_login", "C1: POST /api/admin/login (admin creds → 200)", False, str(e))
    
    # C2: USER creds (created in A) -> 403 with error mentioning 'admin access'
    try:
        resp = requests.post(f"{BASE_URL}/admin/login", json={
            "email": user_email,
            "password": user_password
        }, timeout=10)
        
        if resp.status_code == 403:
            data = resp.json()
            if (data.get("ok") == False and 
                "admin access" in data.get("error", "").lower()):
                log_result("legacy_admin_login", "C2: POST /api/admin/login (user creds → 403)", True, 
                         f"Correctly rejected: {data.get('error')}")
            else:
                log_result("legacy_admin_login", "C2: POST /api/admin/login (user creds → 403)", False, 
                         f"Expected error mentioning 'admin access', got: {data}")
        else:
            log_result("legacy_admin_login", "C2: POST /api/admin/login (user creds → 403)", False, 
                     f"Expected 403, got {resp.status_code}")
    except Exception as e:
        log_result("legacy_admin_login", "C2: POST /api/admin/login (user creds → 403)", False, str(e))
    
    # C3: Wrong password -> 401
    try:
        resp = requests.post(f"{BASE_URL}/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": "wrongpassword"
        }, timeout=10)
        
        if resp.status_code == 401:
            data = resp.json()
            if data.get("ok") == False:
                log_result("legacy_admin_login", "C3: POST /api/admin/login (wrong password → 401)", True, 
                         f"Correctly rejected: {data.get('error')}")
            else:
                log_result("legacy_admin_login", "C3: POST /api/admin/login (wrong password → 401)", False, 
                         f"Expected ok:false, got: {data}")
        else:
            log_result("legacy_admin_login", "C3: POST /api/admin/login (wrong password → 401)", False, 
                     f"Expected 401, got {resp.status_code}")
    except Exception as e:
        log_result("legacy_admin_login", "C3: POST /api/admin/login (wrong password → 401)", False, str(e))

def print_summary():
    """Print final test summary"""
    print("\n" + "="*70)
    print("FINAL TEST SUMMARY - ChemistShop v4 Auth")
    print("="*70)
    
    total_passed = 0
    total_failed = 0
    
    for group, results in test_results.items():
        passed = results["passed"]
        failed = results["failed"]
        total = passed + failed
        status = "✅ PASS" if failed == 0 else "❌ FAIL"
        
        group_name = group.replace("_", " ").upper()
        print(f"\n{status} {group_name}: {passed}/{total} passed")
        
        # Show failed tests
        if failed > 0:
            for detail in results["details"]:
                if not detail["passed"]:
                    print(f"  ❌ {detail['test']}")
                    if detail["message"]:
                        print(f"     {detail['message']}")
        
        total_passed += passed
        total_failed += failed
    
    print("\n" + "="*70)
    grand_total = total_passed + total_failed
    overall_status = "✅ ALL TESTS PASSED" if total_failed == 0 else f"❌ {total_failed} TESTS FAILED"
    print(f"{overall_status}: {total_passed}/{grand_total} passed")
    print("="*70)
    
    return total_failed == 0

if __name__ == "__main__":
    print("ChemistShop v4 Auth Backend Test Suite")
    print(f"Base URL: {BASE_URL}")
    print(f"Admin: {ADMIN_EMAIL}")
    print(f"Testing 3 endpoint groups: Unified Auth (A1-A8), Role Protection (B1-B5), Legacy Admin Login (C1-C3)")
    
    try:
        test_unified_auth()
        test_role_protection()
        test_legacy_admin_login()
        
        success = print_summary()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nFATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
