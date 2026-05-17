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
  ChemistShop admin panel v3 — Adds: email+password admin auth, bulk CSV product import,
  inventory adjustments log + restock orders, customer analytics (LTV/retention/segments),
  prescription chat with WhatsApp deep link.

backend:
  - task: "Admin auth: POST /api/admin/login + GET /api/admin/me + PUT /api/admin/password"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Seeded admin user admin@chemistshop.top / admin123. Returns HMAC-signed token (7-day expiry). /api/admin/me verifies Bearer token. /api/admin/password requires current+next, validates current hash, salts+rehashes new password."
      - working: true
        agent: "testing"
        comment: "✅ ALL 8 AUTH TESTS PASSED: (1) POST /api/admin/login with correct credentials returns token + role=owner, (2) Wrong password correctly returns 401, (3) GET /api/admin/me with valid bearer returns user data, (4) No bearer returns 401, (5) Invalid bearer returns 401, (6) PUT /api/admin/password successfully changed to admin456, (7) Re-login with admin456 successful, (8) Password restored to admin123."

  - task: "Bulk import: POST /api/products/bulk"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Accepts {products:[{name,brand,category,price,mrp,stock,packSize,description,prescription,imageUrl}]}. Returns {created, failed, errors[]}. Each created product also logs inventory entry type 'import'."
      - working: true
        agent: "testing"
        comment: "✅ ALL 2 BULK IMPORT TESTS PASSED: (1) POST /api/products/bulk with 2 products (one with all fields, one minimal) returned {created:2, failed:0}, (2) GET /api/products?search=CSV verified both products exist with IDs starting with 'p-'."

  - task: "Customer analytics: GET /api/admin/customers"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Aggregates orders by phone. Computes orderCount, totalSpent, avgOrderValue, firstOrderDate, lastOrderDate, daysSinceLast, segment(New|Returning|Loyal|VIP). Returns summary with totalLTV, avgLTV, retentionRate, segments breakdown."
      - working: true
        agent: "testing"
        comment: "✅ ALL 2 CUSTOMER ANALYTICS TESTS PASSED: (1) GET /api/admin/customers returns customers[] with all required keys (phone, name, orderCount, totalSpent, avgOrderValue, firstOrderDate, lastOrderDate, daysSinceLast, segment) for 8 customers, (2) Summary structure complete with total, segments{New,Returning,Loyal,VIP}, totalLTV, avgLTV, retentionRate, avgOrderCount."

  - task: "Inventory logs + restock: GET /api/inventory/logs, POST /api/inventory/restock"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Auto-logs entries on POST /api/orders (type='sale', qtyChange negative), POST /api/products (type='initial'), PUT /api/products when stock changes (type='restock'|'adjustment' based on diff), POST /api/products/bulk (type='import'). Manual POST /api/inventory/restock {productId,qty,reason}. GET supports ?productId= filter."
      - working: true
        agent: "testing"
        comment: "✅ ALL 4 INVENTORY TESTS PASSED: (1) GET /api/inventory/logs returns {logs[]}, (2) POST /api/inventory/restock with qty:25 returns {ok:true, log:{type:'restock', qtyChange:25, before, after}} with correct math (after=before+25), (3) POST with qty:-5 returns {log:{type:'adjustment', qtyChange:-5}}, (4) GET /api/inventory/logs?productId=X correctly filters and shows both new entries."

  - task: "Prescription chat: GET/POST /api/prescriptions/:id/messages + PATCH /api/prescriptions/:id"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Messages collection rx_messages keyed by prescriptionId, with sender (admin|customer), authorName, text, createdAt. GET sorted ascending by createdAt. PATCH /api/prescriptions/:id updates status (Under Review|Confirmed|Delivered|Rejected). GET /api/admin/prescriptions supports ?status= and ?search= (id, patientName, phone). GET /api/prescriptions/:id returns single doc."
      - working: true
        agent: "testing"
        comment: "✅ ALL 8 PRESCRIPTION CHAT TESTS PASSED: (1) POST /api/prescriptions creates RX with ID starting 'RX-', (2) GET /api/prescriptions/:id retrieves doc, (3) POST /api/prescriptions/:id/messages with sender='admin' creates message, (4) POST with sender='customer' creates message, (5) GET /api/prescriptions/:id/messages returns 2 messages sorted ascending by createdAt, (6) PATCH /api/prescriptions/:id updates status to 'Confirmed', (7) GET /api/admin/prescriptions?status=Confirmed includes the RX, (8) GET /api/admin/prescriptions?search=9999999 finds RX by phone."

  - task: "Previous APIs still working"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Previously validated — 21 storefront endpoints + 7 admin endpoint groups all PASS."

frontend:
  - task: "Admin login + auth-gated layout"
    implemented: true
    working: "NA"
    file: "/app/app/admin/"
    stuck_count: 0
    priority: "high"
    needs_retesting: false

metadata:
  created_by: "main_agent"
  version: "3.0"
  test_sequence: 2
  run_ui: false

test_plan:
  current_focus:
    - "Admin auth: POST /api/admin/login + GET /api/admin/me + PUT /api/admin/password"
    - "Bulk import: POST /api/products/bulk"
    - "Customer analytics: GET /api/admin/customers"
    - "Inventory logs + restock: GET /api/inventory/logs, POST /api/inventory/restock"
    - "Prescription chat: GET/POST /api/prescriptions/:id/messages + PATCH /api/prescriptions/:id"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      ONLY test the 5 NEW endpoint groups listed in test_plan.current_focus. Do NOT retest prior APIs.
      Base URL: NEXT_PUBLIC_BASE_URL from /app/.env. Seeded admin: admin@chemistshop.top / admin123.

      Suggested flow:
      1) AUTH:
         - POST /api/admin/login {email:'admin@chemistshop.top',password:'admin123'} -> {ok:true, token, user{role:'owner'}}
         - GET /api/admin/me with Authorization: Bearer <token> -> {ok:true, user}; without/invalid token -> 401
         - POST /api/admin/login with wrong password -> 401 {ok:false}
         - PUT /api/admin/password {current:'admin123', next:'admin456'} with bearer token -> {ok:true}
         - re-login with admin456 to confirm; then PUT it back to 'admin123'

      2) BULK IMPORT:
         - POST /api/products/bulk { products: [{name:'CSV Test A', brand:'T', category:'medicines', price:50, stock:10, packSize:'Strip', description:'x', prescription:'false', imageUrl:'https://example.com/a.png'}, {name:'CSV Test B', category:'wellness', price:80, mrp:100, stock:5, imageUrl:'https://example.com/b.png'}] }
           -> {created:2, failed:0}
         - Verify via GET /api/products?search=CSV both products exist with id starting 'p-'

      3) CUSTOMER ANALYTICS:
         - GET /api/admin/customers -> { customers[], summary{ total, segments{New,Returning,Loyal,VIP}, totalLTV, avgLTV, retentionRate, avgOrderCount } }
         - For each customer assert keys: phone, name, orderCount, totalSpent, avgOrderValue, firstOrderDate, lastOrderDate, daysSinceLast, segment

      4) INVENTORY:
         - GET /api/inventory/logs -> {logs[]} (may include sale/initial entries from seeded orders)
         - POST /api/inventory/restock {productId:'<pick first p-XXX from /api/products>', qty:25, reason:'Test restock'} -> {ok:true, stock:<new>, log:{type:'restock', qtyChange:25, before, after}}
         - POST again with qty:-5 -> {ok:true, log:{type:'adjustment', qtyChange:-5}}
         - GET /api/inventory/logs?productId=<that id> -> filtered list, includes the 2 new entries

      5) PRESCRIPTION CHAT:
         - First create a prescription: POST /api/prescriptions {userId:'u-rx-test', patientName:'Test Patient', phone:'9999999999', notes:'Need urgent', fileName:'rx.png', fileDataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='} -> {prescription:{id:'RX-...'}}
         - GET /api/prescriptions/<id> -> returns the doc
         - POST /api/prescriptions/<id>/messages {sender:'admin', authorName:'Pharmacist', text:'Hello, confirming dosage'} -> {message:{id:'msg-...'}}
         - POST another {sender:'customer', text:'Thanks!'} -> ok
         - GET /api/prescriptions/<id>/messages -> {messages:[]} length 2, sorted ascending
         - PATCH /api/prescriptions/<id> {status:'Confirmed'} -> {prescription:{status:'Confirmed'}}
         - GET /api/admin/prescriptions?status=Confirmed -> includes the new RX; ?search=9999999 also matches

      Report PASS/FAIL per group. DO NOT modify any code; only test.
  - agent: "testing"
    message: |
      ✅ BACKEND TESTING COMPLETE - ALL 5 NEW ENDPOINT GROUPS PASSED (24/24 tests)
      
      Test Results Summary:
      1. AUTH (8/8 passed): Login with correct/wrong credentials, token validation (valid/invalid/missing), password change cycle (admin123→admin456→admin123)
      2. BULK IMPORT (2/2 passed): Bulk product creation with mixed field sets, verification via search with p- ID prefix
      3. CUSTOMER ANALYTICS (2/2 passed): Customer data structure with all required fields (phone, name, orderCount, totalSpent, avgOrderValue, firstOrderDate, lastOrderDate, daysSinceLast, segment), summary with segments breakdown
      4. INVENTORY (4/4 passed): Logs retrieval, restock (+25), adjustment (-5), filtered logs by productId
      5. PRESCRIPTION CHAT (8/8 passed): Create RX, retrieve, admin/customer messages, message list sorted ascending, status update to Confirmed, search by status and phone
      
      All endpoints working correctly with proper response structures, status codes, and data validation.
