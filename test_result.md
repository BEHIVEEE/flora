#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================
# Communication Protocol:
# Main agent and testing agent must collaborate via this file.
# 1. Read this file before invoking testing agent
# 2. NEVER invoke testing agent without reading this file first
# 3. NEVER fix something already fixed by testing agent
# 4. ALWAYS take user permission before invoking the frontend testing agent
#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

user_problem_statement: |
  v4 — Unified auth + role-based access. Same backend serves user storefront and admin panel.
  Customers can sign up & log in (role=user). Admin uses the same login (role=admin) but
  is redirected to /admin. Route guards prevent cross-access.

backend:
  - task: "Unified auth: POST /api/auth/signup, POST /api/auth/login, GET /api/auth/me, PUT /api/auth/password"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          Unified users collection (admin migrated from admin_users). Token includes role claim.
          /api/auth/signup creates role='user' only (with name/email/password/phone), rejects dup email (409), validates email format & min 6 char password.
          /api/auth/login returns {token, user{id,email,name,role,phone}}.
          /api/auth/me requires Bearer; 401 if missing/invalid.
          /api/auth/password changes the logged-in user's password.
      - working: true
        agent: "testing"
        comment: |
          ✅ ALL 12 TESTS PASSED (A1-A8):
          A1: POST /api/auth/signup with valid data → 200 {ok:true, token, user{role:'user'}} ✅
          A2: Duplicate signup → 409 with 'already exists' error ✅
          A3: Invalid email 'badmail' → 400 with 'valid email' error ✅
          A4: Password 'short' (5 chars) → 400 with '6 characters' error ✅
          A5a: POST /api/auth/login with correct password → 200 {ok:true, token, user{role:'user'}} ✅
          A5b: POST /api/auth/login with wrong password → 401 ✅
          A6a: GET /api/auth/me with valid Bearer → 200 {ok:true, user{role:'user', email matches}} ✅
          A6b: GET /api/auth/me with no header → 401 ✅
          A6c: GET /api/auth/me with invalid token → 401 ✅
          A7: PUT /api/auth/password with Bearer {current, next} → 200 {ok:true} ✅
          A8a: POST /api/auth/login with old password → 401 ✅
          A8b: POST /api/auth/login with new password → 200 ✅

  - task: "Role-protected: GET /api/admin/me requires role=admin (403 for users)"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Verifies token then checks user.role==='admin'. Returns 403 with 'Admin access required' for user-role tokens, 401 for no token."
      - working: true
        agent: "testing"
        comment: |
          ✅ ALL 5 TESTS PASSED (B1-B5):
          B1: POST /api/auth/login with admin@chemistshop.top/admin123 → 200 with token, user.role='admin' ✅
          B2: GET /api/admin/me with admin Bearer → 200 {ok:true, user{role:'admin'}} ✅
          B3: GET /api/admin/me with USER Bearer → 403 {ok:false, error:'Admin access required'} ✅
          B4: GET /api/admin/me with NO header → 401 ✅
          B5: GET /api/admin/me with garbage Bearer 'xyz.abc' → 401 ✅

  - task: "Legacy POST /api/admin/login rejects non-admin role with 403"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Same query path as /api/auth/login but explicitly 403s if user.role !== 'admin'."
      - working: true
        agent: "testing"
        comment: |
          ✅ ALL 3 TESTS PASSED (C1-C3):
          C1: POST /api/admin/login with admin@chemistshop.top/admin123 → 200 with role='admin' ✅
          C2: POST /api/admin/login with USER credentials → 403 {ok:false, error:'This account does not have admin access'} ✅
          C3: POST /api/admin/login with wrong password → 401 ✅

  - task: "Previously validated APIs still pass"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "low"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "21 storefront + 7 admin + 24 v3 (auth/csv/customers/inventory/rx) endpoints validated previously."

frontend:
  - task: "Login/signup pages + AuthProvider + role-based routing"
    implemented: true
    working: "NA"
    file: "/app/components/AuthProvider.jsx, /app/app/login, /app/app/signup"
    stuck_count: 0
    priority: "high"
    needs_retesting: false

metadata:
  created_by: "main_agent"
  version: "4.0"
  test_sequence: 3
  run_ui: false

test_plan:
  current_focus:
    - "Unified auth: POST /api/auth/signup, POST /api/auth/login, GET /api/auth/me, PUT /api/auth/password"
    - "Role-protected: GET /api/admin/me requires role=admin (403 for users)"
    - "Legacy POST /api/admin/login rejects non-admin role with 403"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      ONLY test the 3 new auth-focused groups. Do not retest previously validated 50+ endpoints.
      Base URL: NEXT_PUBLIC_BASE_URL from /app/.env. Seeded admin: admin@chemistshop.top / admin123.

      Suggested flow:
      A) UNIFIED AUTH:
         A1) POST /api/auth/signup {name:'Test Person', email:'tp+<uniq>@example.com', password:'pass1234', phone:'9876543210'} -> 200 {ok:true, token, user{role:'user'}}
         A2) Re-POST same email -> 409 {ok:false, error contains 'already'}
         A3) POST /api/auth/signup with invalid email 'badmail' -> 400
         A4) POST /api/auth/signup with password 'short' (len 5) -> 400
         A5) POST /api/auth/login {email:<A1 email>, password:'pass1234'} -> 200 {ok:true, token, user{role:'user'}}; wrong password -> 401
         A6) GET /api/auth/me with valid Bearer -> 200 {ok:true, user{role:'user', email matches}}; no header -> 401; invalid token -> 401
         A7) PUT /api/auth/password with Bearer, body {current:'pass1234', next:'newpass1'} -> 200 {ok:true}
         A8) POST /api/auth/login with old password -> 401; with new password 'newpass1' -> 200

      B) ROLE PROTECTION:
         B1) POST /api/auth/login admin@chemistshop.top/admin123 -> token has role=admin; user.role==='admin'
         B2) GET /api/admin/me with admin Bearer -> 200 {ok:true, user{role:'admin'}}
         B3) GET /api/admin/me with USER Bearer (from A5/A8) -> 403 {ok:false, error contains 'Admin'}
         B4) GET /api/admin/me with NO header -> 401
         B5) GET /api/admin/me with garbage Bearer 'xyz.abc' -> 401

      C) LEGACY /api/admin/login:
         C1) POST /api/admin/login admin@chemistshop.top/admin123 -> 200 with role admin
         C2) POST /api/admin/login with USER email/password (from A) -> 403 {ok:false, error contains 'admin access'}
         C3) POST /api/admin/login with wrong password -> 401

      Report PASS/FAIL per case (A1-A8, B1-B5, C1-C3). Do not modify code.
  
  - agent: "testing"
    message: |
      ✅ TESTING COMPLETE - ALL 20 TESTS PASSED (A1-A8, B1-B5, C1-C3)
      
      Created /app/backend_test_v4_auth.py with comprehensive test coverage for the 3 new auth endpoint groups.
      Used unique email with timestamp (testuser1779033894@example.com) to avoid 409 collisions on repeat runs.
      
      Test Results:
      • Unified Auth (A1-A8): 12/12 PASSED ✅
        - Signup validation (email format, password length, duplicate detection) working correctly
        - Login with correct/wrong credentials working correctly
        - GET /api/auth/me with valid/invalid/missing Bearer working correctly
        - Password change flow working correctly (old password rejected, new password accepted)
      
      • Role Protection (B1-B5): 5/5 PASSED ✅
        - Admin login returns role='admin' in token
        - GET /api/admin/me correctly allows admin Bearer (200)
        - GET /api/admin/me correctly rejects user Bearer with 403 and 'Admin access required' error
        - GET /api/admin/me correctly rejects missing/invalid Bearer with 401
      
      • Legacy Admin Login (C1-C3): 3/3 PASSED ✅
        - Admin credentials accepted with 200
        - User credentials rejected with 403 and 'This account does not have admin access' error
        - Wrong password rejected with 401
      
      All endpoints are working as specified. No code modifications were made.
