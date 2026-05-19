#!/usr/bin/env python3
"""
ChemistShop Admin v3 Backend Test Suite
Tests 5 new endpoint groups: Auth, Bulk Import, Customer Analytics, Inventory, Prescription Chat
"""

import requests
import json
import sys

# Read base URL from environment
BASE_URL = "https://chemist-refresh.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@chemistshop.top"
ADMIN_PASSWORD = "admin123"

# Global token storage
auth_token = None
test_results = {
    "auth": {"passed": 0, "failed": 0, "details": []},
    "bulk_import": {"passed": 0, "failed": 0, "details": []},
    "customer_analytics": {"passed": 0, "failed": 0, "details": []},
    "inventory": {"passed": 0, "failed": 0, "details": []},
    "prescription_chat": {"passed": 0, "failed": 0, "details": []},
}

def log_result(group, test_name, passed, message=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {group} - {test_name}")
    if message:
        print(f"  → {message}")
    
    test_results[group]["passed" if passed else "failed"] += 1
    test_results[group]["details"].append({
        "test": test_name,
        "passed": passed,
        "message": message
    })

def test_auth():
    """Test 1: Admin Authentication"""
    global auth_token
    print("\n=== Testing AUTH Endpoints ===")
    
    # 1.1: POST /api/admin/login - Success
    try:
        resp = requests.post(f"{BASE_URL}/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") and data.get("token") and data.get("user", {}).get("role") == "owner":
                auth_token = data["token"]
                log_result("auth", "POST /api/admin/login (success)", True, f"Token received, role={data['user']['role']}")
            else:
                log_result("auth", "POST /api/admin/login (success)", False, f"Invalid response structure: {data}")
        else:
            log_result("auth", "POST /api/admin/login (success)", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result("auth", "POST /api/admin/login (success)", False, str(e))
    
    # 1.2: POST /api/admin/login - Wrong password (401)
    try:
        resp = requests.post(f"{BASE_URL}/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": "wrongpassword"
        }, timeout=10)
        
        if resp.status_code == 401:
            data = resp.json()
            if data.get("ok") == False:
                log_result("auth", "POST /api/admin/login (wrong password → 401)", True, "Correctly rejected")
            else:
                log_result("auth", "POST /api/admin/login (wrong password → 401)", False, f"Expected ok:false, got {data}")
        else:
            log_result("auth", "POST /api/admin/login (wrong password → 401)", False, f"Expected 401, got {resp.status_code}")
    except Exception as e:
        log_result("auth", "POST /api/admin/login (wrong password → 401)", False, str(e))
    
    # 1.3: GET /api/admin/me - With valid token (200)
    try:
        resp = requests.get(f"{BASE_URL}/admin/me", headers={
            "Authorization": f"Bearer {auth_token}"
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") and data.get("user"):
                log_result("auth", "GET /api/admin/me (with bearer → 200)", True, f"User: {data['user'].get('email')}")
            else:
                log_result("auth", "GET /api/admin/me (with bearer → 200)", False, f"Invalid response: {data}")
        else:
            log_result("auth", "GET /api/admin/me (with bearer → 200)", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result("auth", "GET /api/admin/me (with bearer → 200)", False, str(e))
    
    # 1.4: GET /api/admin/me - Without token (401)
    try:
        resp = requests.get(f"{BASE_URL}/admin/me", timeout=10)
        
        if resp.status_code == 401:
            log_result("auth", "GET /api/admin/me (no bearer → 401)", True, "Correctly rejected")
        else:
            log_result("auth", "GET /api/admin/me (no bearer → 401)", False, f"Expected 401, got {resp.status_code}")
    except Exception as e:
        log_result("auth", "GET /api/admin/me (no bearer → 401)", False, str(e))
    
    # 1.5: GET /api/admin/me - Invalid token (401)
    try:
        resp = requests.get(f"{BASE_URL}/admin/me", headers={
            "Authorization": "Bearer invalid-token-xyz"
        }, timeout=10)
        
        if resp.status_code == 401:
            log_result("auth", "GET /api/admin/me (invalid bearer → 401)", True, "Correctly rejected")
        else:
            log_result("auth", "GET /api/admin/me (invalid bearer → 401)", False, f"Expected 401, got {resp.status_code}")
    except Exception as e:
        log_result("auth", "GET /api/admin/me (invalid bearer → 401)", False, str(e))
    
    # 1.6: PUT /api/admin/password - Change to 'admin456'
    try:
        resp = requests.put(f"{BASE_URL}/admin/password", 
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"current": ADMIN_PASSWORD, "next": "admin456"},
            timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok"):
                log_result("auth", "PUT /api/admin/password (change to admin456)", True, "Password changed")
            else:
                log_result("auth", "PUT /api/admin/password (change to admin456)", False, f"Response: {data}")
        else:
            log_result("auth", "PUT /api/admin/password (change to admin456)", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result("auth", "PUT /api/admin/password (change to admin456)", False, str(e))
    
    # 1.7: Re-login with new password 'admin456'
    try:
        resp = requests.post(f"{BASE_URL}/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": "admin456"
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") and data.get("token"):
                auth_token = data["token"]
                log_result("auth", "POST /api/admin/login (with admin456)", True, "Login successful with new password")
            else:
                log_result("auth", "POST /api/admin/login (with admin456)", False, f"Invalid response: {data}")
        else:
            log_result("auth", "POST /api/admin/login (with admin456)", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result("auth", "POST /api/admin/login (with admin456)", False, str(e))
    
    # 1.8: PUT /api/admin/password - Change back to 'admin123'
    try:
        resp = requests.put(f"{BASE_URL}/admin/password", 
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"current": "admin456", "next": ADMIN_PASSWORD},
            timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok"):
                log_result("auth", "PUT /api/admin/password (change back to admin123)", True, "Password restored")
            else:
                log_result("auth", "PUT /api/admin/password (change back to admin123)", False, f"Response: {data}")
        else:
            log_result("auth", "PUT /api/admin/password (change back to admin123)", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result("auth", "PUT /api/admin/password (change back to admin123)", False, str(e))

def test_bulk_import():
    """Test 2: Bulk Product Import"""
    print("\n=== Testing BULK IMPORT Endpoints ===")
    
    # 2.1: POST /api/products/bulk with 2 products
    try:
        resp = requests.post(f"{BASE_URL}/products/bulk", json={
            "products": [
                {
                    "name": "CSV Test A",
                    "brand": "T",
                    "category": "medicines",
                    "price": 50,
                    "stock": 10,
                    "packSize": "Strip",
                    "description": "x",
                    "prescription": "false",
                    "imageUrl": "https://example.com/a.png"
                },
                {
                    "name": "CSV Test B",
                    "category": "wellness",
                    "price": 80,
                    "mrp": 100,
                    "stock": 5,
                    "imageUrl": "https://example.com/b.png"
                }
            ]
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("created") == 2 and data.get("failed") == 0:
                log_result("bulk_import", "POST /api/products/bulk (2 products)", True, f"Created: {data['created']}, Failed: {data['failed']}")
            else:
                log_result("bulk_import", "POST /api/products/bulk (2 products)", False, f"Expected created:2, failed:0, got {data}")
        else:
            log_result("bulk_import", "POST /api/products/bulk (2 products)", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result("bulk_import", "POST /api/products/bulk (2 products)", False, str(e))
    
    # 2.2: GET /api/products?search=CSV - Verify both products exist
    try:
        resp = requests.get(f"{BASE_URL}/products?search=CSV", timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            products = data.get("products", [])
            if len(products) >= 2:
                csv_products = [p for p in products if "CSV Test" in p.get("name", "")]
                if len(csv_products) >= 2:
                    ids_valid = all(p.get("id", "").startswith("p-") for p in csv_products)
                    if ids_valid:
                        log_result("bulk_import", "GET /api/products?search=CSV (verify)", True, f"Found {len(csv_products)} CSV products with p- IDs")
                    else:
                        log_result("bulk_import", "GET /api/products?search=CSV (verify)", False, "Some products don't have p- prefix")
                else:
                    log_result("bulk_import", "GET /api/products?search=CSV (verify)", False, f"Found only {len(csv_products)} CSV products")
            else:
                log_result("bulk_import", "GET /api/products?search=CSV (verify)", False, f"Expected at least 2 products, got {len(products)}")
        else:
            log_result("bulk_import", "GET /api/products?search=CSV (verify)", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result("bulk_import", "GET /api/products?search=CSV (verify)", False, str(e))

def test_customer_analytics():
    """Test 3: Customer Analytics"""
    print("\n=== Testing CUSTOMER ANALYTICS Endpoints ===")
    
    # 3.1: GET /api/admin/customers
    try:
        resp = requests.get(f"{BASE_URL}/admin/customers", timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            customers = data.get("customers", [])
            summary = data.get("summary", {})
            
            # Check customers array structure
            if customers and len(customers) > 0:
                sample = customers[0]
                required_keys = ["phone", "name", "orderCount", "totalSpent", "avgOrderValue", 
                               "firstOrderDate", "lastOrderDate", "daysSinceLast", "segment"]
                missing_keys = [k for k in required_keys if k not in sample]
                
                if not missing_keys:
                    log_result("customer_analytics", "GET /api/admin/customers (customers structure)", True, 
                             f"All required keys present in {len(customers)} customers")
                else:
                    log_result("customer_analytics", "GET /api/admin/customers (customers structure)", False, 
                             f"Missing keys: {missing_keys}")
            else:
                log_result("customer_analytics", "GET /api/admin/customers (customers structure)", False, 
                         "No customers found")
            
            # Check summary structure
            summary_keys = ["total", "segments", "totalLTV", "avgLTV", "retentionRate", "avgOrderCount"]
            missing_summary = [k for k in summary_keys if k not in summary]
            
            if not missing_summary:
                segments = summary.get("segments", {})
                segment_keys = ["New", "Returning", "Loyal", "VIP"]
                missing_segments = [k for k in segment_keys if k not in segments]
                
                if not missing_segments:
                    log_result("customer_analytics", "GET /api/admin/customers (summary structure)", True, 
                             f"Summary complete: total={summary['total']}, segments={segments}")
                else:
                    log_result("customer_analytics", "GET /api/admin/customers (summary structure)", False, 
                             f"Missing segment keys: {missing_segments}")
            else:
                log_result("customer_analytics", "GET /api/admin/customers (summary structure)", False, 
                         f"Missing summary keys: {missing_summary}")
        else:
            log_result("customer_analytics", "GET /api/admin/customers", False, 
                     f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result("customer_analytics", "GET /api/admin/customers", False, str(e))

def test_inventory():
    """Test 4: Inventory Logs and Restock"""
    print("\n=== Testing INVENTORY Endpoints ===")
    
    product_id = None
    
    # 4.1: GET /api/inventory/logs
    try:
        resp = requests.get(f"{BASE_URL}/inventory/logs", timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if "logs" in data:
                log_result("inventory", "GET /api/inventory/logs", True, f"Retrieved {len(data['logs'])} logs")
            else:
                log_result("inventory", "GET /api/inventory/logs", False, "Missing 'logs' key in response")
        else:
            log_result("inventory", "GET /api/inventory/logs", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result("inventory", "GET /api/inventory/logs", False, str(e))
    
    # Get first product ID
    try:
        resp = requests.get(f"{BASE_URL}/products?limit=1", timeout=10)
        if resp.status_code == 200:
            products = resp.json().get("products", [])
            if products:
                product_id = products[0].get("id")
                print(f"  → Using product ID: {product_id}")
    except Exception as e:
        print(f"  → Failed to get product ID: {e}")
    
    if not product_id:
        log_result("inventory", "POST /api/inventory/restock (qty:25)", False, "No product ID available")
        log_result("inventory", "POST /api/inventory/restock (qty:-5)", False, "No product ID available")
        log_result("inventory", "GET /api/inventory/logs?productId=X", False, "No product ID available")
        return
    
    # 4.2: POST /api/inventory/restock with qty:25
    try:
        resp = requests.post(f"{BASE_URL}/inventory/restock", json={
            "productId": product_id,
            "qty": 25,
            "reason": "Test restock"
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") and data.get("log"):
                log_entry = data["log"]
                if (log_entry.get("type") == "restock" and 
                    log_entry.get("qtyChange") == 25 and
                    log_entry.get("after") == log_entry.get("before", 0) + 25):
                    log_result("inventory", "POST /api/inventory/restock (qty:25)", True, 
                             f"Restock successful: before={log_entry['before']}, after={log_entry['after']}")
                else:
                    log_result("inventory", "POST /api/inventory/restock (qty:25)", False, 
                             f"Invalid log entry: {log_entry}")
            else:
                log_result("inventory", "POST /api/inventory/restock (qty:25)", False, f"Response: {data}")
        else:
            log_result("inventory", "POST /api/inventory/restock (qty:25)", False, 
                     f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result("inventory", "POST /api/inventory/restock (qty:25)", False, str(e))
    
    # 4.3: POST /api/inventory/restock with qty:-5
    try:
        resp = requests.post(f"{BASE_URL}/inventory/restock", json={
            "productId": product_id,
            "qty": -5,
            "reason": "Test adjustment"
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") and data.get("log"):
                log_entry = data["log"]
                if log_entry.get("type") == "adjustment" and log_entry.get("qtyChange") == -5:
                    log_result("inventory", "POST /api/inventory/restock (qty:-5)", True, 
                             f"Adjustment successful: type={log_entry['type']}, qtyChange={log_entry['qtyChange']}")
                else:
                    log_result("inventory", "POST /api/inventory/restock (qty:-5)", False, 
                             f"Expected type='adjustment', qtyChange=-5, got {log_entry}")
            else:
                log_result("inventory", "POST /api/inventory/restock (qty:-5)", False, f"Response: {data}")
        else:
            log_result("inventory", "POST /api/inventory/restock (qty:-5)", False, 
                     f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result("inventory", "POST /api/inventory/restock (qty:-5)", False, str(e))
    
    # 4.4: GET /api/inventory/logs?productId=X
    try:
        resp = requests.get(f"{BASE_URL}/inventory/logs?productId={product_id}", timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            logs = data.get("logs", [])
            # Look for our test entries
            restock_entry = next((l for l in logs if l.get("type") == "restock" and l.get("reason") == "Test restock"), None)
            adjustment_entry = next((l for l in logs if l.get("type") == "adjustment" and l.get("reason") == "Test adjustment"), None)
            
            if restock_entry and adjustment_entry:
                log_result("inventory", "GET /api/inventory/logs?productId=X (filtered)", True, 
                         f"Found both test entries in {len(logs)} logs")
            else:
                log_result("inventory", "GET /api/inventory/logs?productId=X (filtered)", False, 
                         f"Missing entries: restock={bool(restock_entry)}, adjustment={bool(adjustment_entry)}")
        else:
            log_result("inventory", "GET /api/inventory/logs?productId=X (filtered)", False, 
                     f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result("inventory", "GET /api/inventory/logs?productId=X (filtered)", False, str(e))

def test_prescription_chat():
    """Test 5: Prescription Chat"""
    print("\n=== Testing PRESCRIPTION CHAT Endpoints ===")
    
    rx_id = None
    
    # 5.1: POST /api/prescriptions - Create prescription
    try:
        resp = requests.post(f"{BASE_URL}/prescriptions", json={
            "userId": "u-rx-test",
            "patientName": "Test Patient",
            "phone": "9999999999",
            "notes": "Need urgent",
            "fileName": "rx.png",
            "fileDataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            prescription = data.get("prescription", {})
            rx_id = prescription.get("id")
            if rx_id and rx_id.startswith("RX-"):
                log_result("prescription_chat", "POST /api/prescriptions (create)", True, f"Created RX: {rx_id}")
            else:
                log_result("prescription_chat", "POST /api/prescriptions (create)", False, f"Invalid ID: {rx_id}")
        else:
            log_result("prescription_chat", "POST /api/prescriptions (create)", False, 
                     f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result("prescription_chat", "POST /api/prescriptions (create)", False, str(e))
    
    if not rx_id:
        log_result("prescription_chat", "GET /api/prescriptions/:id", False, "No RX ID available")
        log_result("prescription_chat", "POST /api/prescriptions/:id/messages (admin)", False, "No RX ID available")
        log_result("prescription_chat", "POST /api/prescriptions/:id/messages (customer)", False, "No RX ID available")
        log_result("prescription_chat", "GET /api/prescriptions/:id/messages", False, "No RX ID available")
        log_result("prescription_chat", "PATCH /api/prescriptions/:id", False, "No RX ID available")
        log_result("prescription_chat", "GET /api/admin/prescriptions?status=Confirmed", False, "No RX ID available")
        log_result("prescription_chat", "GET /api/admin/prescriptions?search=9999999", False, "No RX ID available")
        return
    
    # 5.2: GET /api/prescriptions/:id
    try:
        resp = requests.get(f"{BASE_URL}/prescriptions/{rx_id}", timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            prescription = data.get("prescription", {})
            if prescription.get("id") == rx_id:
                log_result("prescription_chat", "GET /api/prescriptions/:id", True, f"Retrieved RX: {rx_id}")
            else:
                log_result("prescription_chat", "GET /api/prescriptions/:id", False, f"ID mismatch: {prescription}")
        else:
            log_result("prescription_chat", "GET /api/prescriptions/:id", False, 
                     f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result("prescription_chat", "GET /api/prescriptions/:id", False, str(e))
    
    # 5.3: POST /api/prescriptions/:id/messages (admin)
    try:
        resp = requests.post(f"{BASE_URL}/prescriptions/{rx_id}/messages", json={
            "sender": "admin",
            "authorName": "Pharmacist",
            "text": "Hello, confirming dosage"
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            message = data.get("message", {})
            if message.get("id") and message.get("sender") == "admin":
                log_result("prescription_chat", "POST /api/prescriptions/:id/messages (admin)", True, 
                         f"Message created: {message['id']}")
            else:
                log_result("prescription_chat", "POST /api/prescriptions/:id/messages (admin)", False, 
                         f"Invalid message: {message}")
        else:
            log_result("prescription_chat", "POST /api/prescriptions/:id/messages (admin)", False, 
                     f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result("prescription_chat", "POST /api/prescriptions/:id/messages (admin)", False, str(e))
    
    # 5.4: POST /api/prescriptions/:id/messages (customer)
    try:
        resp = requests.post(f"{BASE_URL}/prescriptions/{rx_id}/messages", json={
            "sender": "customer",
            "text": "Thanks!"
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            message = data.get("message", {})
            if message.get("id") and message.get("sender") == "customer":
                log_result("prescription_chat", "POST /api/prescriptions/:id/messages (customer)", True, 
                         f"Message created: {message['id']}")
            else:
                log_result("prescription_chat", "POST /api/prescriptions/:id/messages (customer)", False, 
                         f"Invalid message: {message}")
        else:
            log_result("prescription_chat", "POST /api/prescriptions/:id/messages (customer)", False, 
                     f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result("prescription_chat", "POST /api/prescriptions/:id/messages (customer)", False, str(e))
    
    # 5.5: GET /api/prescriptions/:id/messages
    try:
        resp = requests.get(f"{BASE_URL}/prescriptions/{rx_id}/messages", timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            messages = data.get("messages", [])
            if len(messages) >= 2:
                # Check if sorted by createdAt ascending
                timestamps = [m.get("createdAt") for m in messages]
                is_sorted = all(timestamps[i] <= timestamps[i+1] for i in range(len(timestamps)-1))
                if is_sorted:
                    log_result("prescription_chat", "GET /api/prescriptions/:id/messages", True, 
                             f"Retrieved {len(messages)} messages, sorted ascending")
                else:
                    log_result("prescription_chat", "GET /api/prescriptions/:id/messages", False, 
                             "Messages not sorted by createdAt ascending")
            else:
                log_result("prescription_chat", "GET /api/prescriptions/:id/messages", False, 
                         f"Expected at least 2 messages, got {len(messages)}")
        else:
            log_result("prescription_chat", "GET /api/prescriptions/:id/messages", False, 
                     f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result("prescription_chat", "GET /api/prescriptions/:id/messages", False, str(e))
    
    # 5.6: PATCH /api/prescriptions/:id (update status)
    try:
        resp = requests.patch(f"{BASE_URL}/prescriptions/{rx_id}", json={
            "status": "Confirmed"
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            prescription = data.get("prescription", {})
            if prescription.get("status") == "Confirmed":
                log_result("prescription_chat", "PATCH /api/prescriptions/:id (status=Confirmed)", True, 
                         f"Status updated to Confirmed")
            else:
                log_result("prescription_chat", "PATCH /api/prescriptions/:id (status=Confirmed)", False, 
                         f"Status not updated: {prescription.get('status')}")
        else:
            log_result("prescription_chat", "PATCH /api/prescriptions/:id (status=Confirmed)", False, 
                     f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result("prescription_chat", "PATCH /api/prescriptions/:id (status=Confirmed)", False, str(e))
    
    # 5.7: GET /api/admin/prescriptions?status=Confirmed
    try:
        resp = requests.get(f"{BASE_URL}/admin/prescriptions?status=Confirmed", timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            prescriptions = data.get("prescriptions", [])
            found = any(p.get("id") == rx_id for p in prescriptions)
            if found:
                log_result("prescription_chat", "GET /api/admin/prescriptions?status=Confirmed", True, 
                         f"Found RX {rx_id} in Confirmed list")
            else:
                log_result("prescription_chat", "GET /api/admin/prescriptions?status=Confirmed", False, 
                         f"RX {rx_id} not found in Confirmed list")
        else:
            log_result("prescription_chat", "GET /api/admin/prescriptions?status=Confirmed", False, 
                     f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result("prescription_chat", "GET /api/admin/prescriptions?status=Confirmed", False, str(e))
    
    # 5.8: GET /api/admin/prescriptions?search=9999999
    try:
        resp = requests.get(f"{BASE_URL}/admin/prescriptions?search=9999999", timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            prescriptions = data.get("prescriptions", [])
            found = any(p.get("id") == rx_id for p in prescriptions)
            if found:
                log_result("prescription_chat", "GET /api/admin/prescriptions?search=9999999", True, 
                         f"Found RX {rx_id} by phone search")
            else:
                log_result("prescription_chat", "GET /api/admin/prescriptions?search=9999999", False, 
                         f"RX {rx_id} not found by phone search")
        else:
            log_result("prescription_chat", "GET /api/admin/prescriptions?search=9999999", False, 
                     f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_result("prescription_chat", "GET /api/admin/prescriptions?search=9999999", False, str(e))

def print_summary():
    """Print final test summary"""
    print("\n" + "="*60)
    print("FINAL TEST SUMMARY")
    print("="*60)
    
    total_passed = 0
    total_failed = 0
    
    for group, results in test_results.items():
        passed = results["passed"]
        failed = results["failed"]
        total = passed + failed
        status = "✅ PASS" if failed == 0 else "❌ FAIL"
        
        print(f"\n{status} {group.upper().replace('_', ' ')}: {passed}/{total} passed")
        total_passed += passed
        total_failed += failed
    
    print("\n" + "="*60)
    grand_total = total_passed + total_failed
    overall_status = "✅ ALL TESTS PASSED" if total_failed == 0 else f"❌ {total_failed} TESTS FAILED"
    print(f"{overall_status}: {total_passed}/{grand_total} passed")
    print("="*60)
    
    return total_failed == 0

if __name__ == "__main__":
    print("ChemistShop Admin v3 Backend Test Suite")
    print(f"Base URL: {BASE_URL}")
    print(f"Admin: {ADMIN_EMAIL}")
    
    try:
        test_auth()
        test_bulk_import()
        test_customer_analytics()
        test_inventory()
        test_prescription_chat()
        
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
