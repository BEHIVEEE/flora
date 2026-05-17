#!/usr/bin/env python3
"""
Backend API Test Suite for NEW Admin Panel APIs
Tests only the NEW endpoints added for admin panel functionality
"""
import requests
import json
from datetime import datetime, timedelta

# Read base URL from .env
BASE_URL = "https://chemist-refresh.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

def print_test(name, passed, details=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {name}")
    if details:
        print(f"   {details}")
    print()

def test_admin_stats():
    """Test 1: GET /api/admin/stats"""
    print("=" * 80)
    print("TEST 1: Admin Dashboard Stats")
    print("=" * 80)
    
    try:
        resp = requests.get(f"{API_BASE}/admin/stats", timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print_test("Admin Stats API", False, f"Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        
        # Check all required keys
        required_keys = [
            'todayRevenue', 'todayOrders', 'weekRevenue', 'weekOrders',
            'monthRevenue', 'monthOrders', 'productsCount', 'lowStockCount',
            'lowStock', 'pendingCount', 'totalOrders', 'recent', 'series', 'topProducts'
        ]
        
        missing = [k for k in required_keys if k not in data]
        if missing:
            print_test("Admin Stats - Required Keys", False, f"Missing keys: {missing}")
            return False
        
        print_test("Admin Stats - Required Keys", True, "All keys present")
        
        # Verify productsCount = 30
        if data['productsCount'] != 30:
            print_test("Admin Stats - Products Count", False, f"Expected 30, got {data['productsCount']}")
            return False
        print_test("Admin Stats - Products Count", True, f"productsCount = {data['productsCount']}")
        
        # Verify lowStock array (<=8)
        if len(data['lowStock']) > 8:
            print_test("Admin Stats - Low Stock Array", False, f"Expected <=8, got {len(data['lowStock'])}")
            return False
        print_test("Admin Stats - Low Stock Array", True, f"lowStock count = {len(data['lowStock'])}")
        
        # Verify recent orders (<=8)
        if len(data['recent']) > 8:
            print_test("Admin Stats - Recent Orders", False, f"Expected <=8, got {len(data['recent'])}")
            return False
        
        # Check recent order structure
        if data['recent']:
            order = data['recent'][0]
            required_order_keys = ['id', 'total', 'status', 'address', 'items']
            missing_order = [k for k in required_order_keys if k not in order]
            if missing_order:
                print_test("Admin Stats - Recent Order Structure", False, f"Missing: {missing_order}")
                return False
        
        print_test("Admin Stats - Recent Orders", True, f"recent count = {len(data['recent'])}")
        
        # Verify series (7 days)
        if len(data['series']) != 7:
            print_test("Admin Stats - Series Length", False, f"Expected 7, got {len(data['series'])}")
            return False
        
        # Check series structure
        series_item = data['series'][0]
        required_series = ['date', 'label', 'revenue', 'orders']
        missing_series = [k for k in required_series if k not in series_item]
        if missing_series:
            print_test("Admin Stats - Series Structure", False, f"Missing: {missing_series}")
            return False
        
        print_test("Admin Stats - Series", True, "7-day series with correct structure")
        
        # Verify topProducts (<=5)
        if len(data['topProducts']) > 5:
            print_test("Admin Stats - Top Products", False, f"Expected <=5, got {len(data['topProducts'])}")
            return False
        
        print_test("Admin Stats - Top Products", True, f"topProducts count = {len(data['topProducts'])}")
        
        return True
        
    except Exception as e:
        print_test("Admin Stats API", False, f"Exception: {str(e)}")
        return False

def test_admin_revenue():
    """Test 2: GET /api/admin/revenue with different ranges"""
    print("=" * 80)
    print("TEST 2: Admin Revenue Series")
    print("=" * 80)
    
    all_passed = True
    
    # Test today
    try:
        resp = requests.get(f"{API_BASE}/admin/revenue?range=today", timeout=10)
        if resp.status_code != 200:
            print_test("Revenue - Today", False, f"Status {resp.status_code}")
            all_passed = False
        else:
            data = resp.json()
            if 'range' not in data or 'series' not in data or 'total' not in data:
                print_test("Revenue - Today Structure", False, "Missing keys")
                all_passed = False
            elif len(data['series']) != 1:
                print_test("Revenue - Today Series", False, f"Expected 1 day, got {len(data['series'])}")
                all_passed = False
            else:
                # Check series item structure
                item = data['series'][0]
                if not all(k in item for k in ['revenue', 'orders', 'date', 'label']):
                    print_test("Revenue - Today Item Structure", False, "Missing keys in series item")
                    all_passed = False
                else:
                    print_test("Revenue - Today", True, f"1 day, total={data['total']}")
    except Exception as e:
        print_test("Revenue - Today", False, f"Exception: {str(e)}")
        all_passed = False
    
    # Test week
    try:
        resp = requests.get(f"{API_BASE}/admin/revenue?range=week", timeout=10)
        if resp.status_code != 200:
            print_test("Revenue - Week", False, f"Status {resp.status_code}")
            all_passed = False
        else:
            data = resp.json()
            if len(data['series']) != 7:
                print_test("Revenue - Week Series", False, f"Expected 7 days, got {len(data['series'])}")
                all_passed = False
            else:
                print_test("Revenue - Week", True, f"7 days, total={data['total']}")
    except Exception as e:
        print_test("Revenue - Week", False, f"Exception: {str(e)}")
        all_passed = False
    
    # Test month
    try:
        resp = requests.get(f"{API_BASE}/admin/revenue?range=month", timeout=10)
        if resp.status_code != 200:
            print_test("Revenue - Month", False, f"Status {resp.status_code}")
            all_passed = False
        else:
            data = resp.json()
            if len(data['series']) != 30:
                print_test("Revenue - Month Series", False, f"Expected 30 days, got {len(data['series'])}")
                all_passed = False
            else:
                print_test("Revenue - Month", True, f"30 days, total={data['total']}")
    except Exception as e:
        print_test("Revenue - Month", False, f"Exception: {str(e)}")
        all_passed = False
    
    return all_passed

def test_admin_orders():
    """Test 3: GET /api/admin/orders with filters"""
    print("=" * 80)
    print("TEST 3: Admin Orders List with Filters")
    print("=" * 80)
    
    all_passed = True
    
    # Test without filters
    try:
        resp = requests.get(f"{API_BASE}/admin/orders", timeout=10)
        if resp.status_code != 200:
            print_test("Admin Orders - No Filter", False, f"Status {resp.status_code}")
            all_passed = False
        else:
            data = resp.json()
            orders = data.get('orders', [])
            if len(orders) < 20:
                print_test("Admin Orders - Count", False, f"Expected at least 20, got {len(orders)}")
                all_passed = False
            else:
                print_test("Admin Orders - No Filter", True, f"Retrieved {len(orders)} orders")
    except Exception as e:
        print_test("Admin Orders - No Filter", False, f"Exception: {str(e)}")
        all_passed = False
    
    # Test with status filter
    try:
        resp = requests.get(f"{API_BASE}/admin/orders?status=Delivered", timeout=10)
        if resp.status_code != 200:
            print_test("Admin Orders - Status Filter", False, f"Status {resp.status_code}")
            all_passed = False
        else:
            data = resp.json()
            orders = data.get('orders', [])
            # Verify all have status = Delivered
            non_delivered = [o for o in orders if o.get('status') != 'Delivered']
            if non_delivered:
                print_test("Admin Orders - Status Filter", False, f"{len(non_delivered)} orders not Delivered")
                all_passed = False
            else:
                print_test("Admin Orders - Status Filter", True, f"All {len(orders)} orders are Delivered")
    except Exception as e:
        print_test("Admin Orders - Status Filter", False, f"Exception: {str(e)}")
        all_passed = False
    
    # Test with search filter (using 'Aaruhi' from seeded data)
    try:
        resp = requests.get(f"{API_BASE}/admin/orders?search=Aaruhi", timeout=10)
        if resp.status_code != 200:
            print_test("Admin Orders - Search Filter", False, f"Status {resp.status_code}")
            all_passed = False
        else:
            data = resp.json()
            orders = data.get('orders', [])
            # Verify all match the search
            matched = all('Aaruhi' in o.get('address', {}).get('name', '') for o in orders)
            if not matched:
                print_test("Admin Orders - Search Filter", False, "Some orders don't match search")
                all_passed = False
            else:
                print_test("Admin Orders - Search Filter", True, f"Found {len(orders)} orders for 'Aaruhi'")
    except Exception as e:
        print_test("Admin Orders - Search Filter", False, f"Exception: {str(e)}")
        all_passed = False
    
    return all_passed

def test_products_crud():
    """Test 4: Products CRUD operations"""
    print("=" * 80)
    print("TEST 4: Products CRUD")
    print("=" * 80)
    
    all_passed = True
    created_id = None
    
    # POST - Create product
    try:
        payload = {
            "name": "Test Aspirin 75mg",
            "brand": "TestBrand",
            "category": "medicines",
            "price": 25,
            "mrp": 30,
            "stock": 100,
            "packSize": "Strip of 10",
            "images": ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="],
            "prescription": False,
            "description": "Test desc"
        }
        resp = requests.post(f"{API_BASE}/products", json=payload, timeout=10)
        if resp.status_code != 200:
            print_test("Products - Create", False, f"Status {resp.status_code}")
            all_passed = False
        else:
            data = resp.json()
            product = data.get('product', {})
            created_id = product.get('id')
            
            # Verify id starts with 'p-'
            if not created_id or not created_id.startswith('p-'):
                print_test("Products - Create ID", False, f"ID doesn't start with 'p-': {created_id}")
                all_passed = False
            else:
                print_test("Products - Create ID", True, f"ID = {created_id}")
            
            # Verify image = images[0]
            if product.get('image') != payload['images'][0]:
                print_test("Products - Create Image", False, "image != images[0]")
                all_passed = False
            else:
                print_test("Products - Create Image", True, "image = images[0]")
    except Exception as e:
        print_test("Products - Create", False, f"Exception: {str(e)}")
        all_passed = False
        return False
    
    if not created_id:
        print("Cannot continue CRUD tests without created product ID")
        return False
    
    # GET - Retrieve product
    try:
        resp = requests.get(f"{API_BASE}/products/{created_id}", timeout=10)
        if resp.status_code != 200:
            print_test("Products - Get", False, f"Status {resp.status_code}")
            all_passed = False
        else:
            data = resp.json()
            product = data.get('product', {})
            if product.get('id') != created_id:
                print_test("Products - Get", False, "Product ID mismatch")
                all_passed = False
            else:
                print_test("Products - Get", True, f"Retrieved product {created_id}")
    except Exception as e:
        print_test("Products - Get", False, f"Exception: {str(e)}")
        all_passed = False
    
    # PUT - Update product
    try:
        update_payload = {
            "price": 22,
            "stock": 50,
            "name": "Test Aspirin 75mg Updated"
        }
        resp = requests.put(f"{API_BASE}/products/{created_id}", json=update_payload, timeout=10)
        if resp.status_code != 200:
            print_test("Products - Update", False, f"Status {resp.status_code}")
            all_passed = False
        else:
            data = resp.json()
            product = data.get('product', {})
            
            # Verify changes
            if product.get('price') != 22 or product.get('stock') != 50 or product.get('name') != "Test Aspirin 75mg Updated":
                print_test("Products - Update", False, "Changes not applied correctly")
                all_passed = False
            else:
                print_test("Products - Update", True, "Price, stock, and name updated")
        
        # Verify persistence with GET
        resp = requests.get(f"{API_BASE}/products/{created_id}", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            product = data.get('product', {})
            if product.get('price') == 22 and product.get('stock') == 50:
                print_test("Products - Update Persistence", True, "Changes persisted")
            else:
                print_test("Products - Update Persistence", False, "Changes not persisted")
                all_passed = False
    except Exception as e:
        print_test("Products - Update", False, f"Exception: {str(e)}")
        all_passed = False
    
    # DELETE - Remove product
    try:
        resp = requests.delete(f"{API_BASE}/products/{created_id}", timeout=10)
        if resp.status_code != 200:
            print_test("Products - Delete", False, f"Status {resp.status_code}")
            all_passed = False
        else:
            print_test("Products - Delete", True, f"Deleted product {created_id}")
        
        # Verify deletion with GET (should return 404)
        resp = requests.get(f"{API_BASE}/products/{created_id}", timeout=10)
        if resp.status_code != 404:
            print_test("Products - Delete Verification", False, f"Expected 404, got {resp.status_code}")
            all_passed = False
        else:
            print_test("Products - Delete Verification", True, "Product not found after deletion")
    except Exception as e:
        print_test("Products - Delete", False, f"Exception: {str(e)}")
        all_passed = False
    
    return all_passed

def test_order_status_update():
    """Test 5: Order status update"""
    print("=" * 80)
    print("TEST 5: Order Status Update")
    print("=" * 80)
    
    all_passed = True
    
    # Get first order
    try:
        resp = requests.get(f"{API_BASE}/admin/orders", timeout=10)
        if resp.status_code != 200:
            print_test("Order Status - Get Orders", False, f"Status {resp.status_code}")
            return False
        
        data = resp.json()
        orders = data.get('orders', [])
        if not orders:
            print_test("Order Status - Get Orders", False, "No orders found")
            return False
        
        order_id = orders[0]['id']
        print(f"Testing with order ID: {order_id}")
        
        # PATCH - Update to Confirmed
        update_payload = {"status": "Confirmed"}
        resp = requests.patch(f"{API_BASE}/orders/{order_id}", json=update_payload, timeout=10)
        if resp.status_code != 200:
            print_test("Order Status - Update to Confirmed", False, f"Status {resp.status_code}")
            all_passed = False
        else:
            data = resp.json()
            order = data.get('order', {})
            
            # Verify status
            if order.get('status') != 'Confirmed':
                print_test("Order Status - Confirmed Status", False, f"Status is {order.get('status')}")
                all_passed = False
            else:
                print_test("Order Status - Confirmed Status", True)
            
            # Verify trackingSteps
            steps = order.get('trackingSteps', [])
            if len(steps) != 4:
                print_test("Order Status - Tracking Steps Count", False, f"Expected 4, got {len(steps)}")
                all_passed = False
            else:
                # Order Confirmed: true, Packed: true, Out for Delivery: false, Delivered: false
                expected = [True, True, False, False]
                actual = [s.get('done') for s in steps]
                if actual != expected:
                    print_test("Order Status - Confirmed Tracking", False, f"Expected {expected}, got {actual}")
                    all_passed = False
                else:
                    print_test("Order Status - Confirmed Tracking", True, "Order Confirmed & Packed done")
        
        # PATCH - Update to Delivered
        update_payload = {"status": "Delivered"}
        resp = requests.patch(f"{API_BASE}/orders/{order_id}", json=update_payload, timeout=10)
        if resp.status_code != 200:
            print_test("Order Status - Update to Delivered", False, f"Status {resp.status_code}")
            all_passed = False
        else:
            data = resp.json()
            order = data.get('order', {})
            
            # Verify all tracking steps done
            steps = order.get('trackingSteps', [])
            all_done = all(s.get('done') for s in steps)
            if not all_done:
                print_test("Order Status - Delivered Tracking", False, "Not all steps done")
                all_passed = False
            else:
                print_test("Order Status - Delivered Tracking", True, "All 4 tracking steps done")
        
    except Exception as e:
        print_test("Order Status Update", False, f"Exception: {str(e)}")
        all_passed = False
    
    return all_passed

def test_slots_crud():
    """Test 6: Delivery Slots CRUD"""
    print("=" * 80)
    print("TEST 6: Delivery Slots CRUD")
    print("=" * 80)
    
    all_passed = True
    created_slot_id = None
    
    # GET - List slots (should have at least 5 default)
    try:
        resp = requests.get(f"{API_BASE}/slots", timeout=10)
        if resp.status_code != 200:
            print_test("Slots - List", False, f"Status {resp.status_code}")
            all_passed = False
        else:
            data = resp.json()
            slots = data.get('slots', [])
            if len(slots) < 5:
                print_test("Slots - Default Count", False, f"Expected at least 5, got {len(slots)}")
                all_passed = False
            else:
                # Check for slot-1 through slot-5
                slot_ids = [s.get('id') for s in slots]
                has_defaults = all(f'slot-{i}' in slot_ids for i in range(1, 6))
                if not has_defaults:
                    print_test("Slots - Default IDs", False, "Missing default slots slot-1 to slot-5")
                    all_passed = False
                else:
                    print_test("Slots - List", True, f"Found {len(slots)} slots including defaults")
    except Exception as e:
        print_test("Slots - List", False, f"Exception: {str(e)}")
        all_passed = False
    
    # POST - Create slot
    try:
        payload = {
            "label": "Late Night",
            "startTime": "20:00",
            "endTime": "22:00",
            "capacity": 5,
            "active": True
        }
        resp = requests.post(f"{API_BASE}/slots", json=payload, timeout=10)
        if resp.status_code != 200:
            print_test("Slots - Create", False, f"Status {resp.status_code}")
            all_passed = False
        else:
            data = resp.json()
            slot = data.get('slot', {})
            created_slot_id = slot.get('id')
            
            # Verify id starts with 'slot-'
            if not created_slot_id or not created_slot_id.startswith('slot-'):
                print_test("Slots - Create ID", False, f"ID doesn't start with 'slot-': {created_slot_id}")
                all_passed = False
            else:
                print_test("Slots - Create", True, f"Created slot {created_slot_id}")
    except Exception as e:
        print_test("Slots - Create", False, f"Exception: {str(e)}")
        all_passed = False
        return False
    
    if not created_slot_id:
        print("Cannot continue slot tests without created slot ID")
        return False
    
    # PUT - Update slot
    try:
        update_payload = {
            "active": False,
            "capacity": 3
        }
        resp = requests.put(f"{API_BASE}/slots/{created_slot_id}", json=update_payload, timeout=10)
        if resp.status_code != 200:
            print_test("Slots - Update", False, f"Status {resp.status_code}")
            all_passed = False
        else:
            data = resp.json()
            slot = data.get('slot', {})
            
            # Verify changes
            if slot.get('active') != False or slot.get('capacity') != 3:
                print_test("Slots - Update", False, "Changes not applied correctly")
                all_passed = False
            else:
                print_test("Slots - Update", True, "active=false, capacity=3")
    except Exception as e:
        print_test("Slots - Update", False, f"Exception: {str(e)}")
        all_passed = False
    
    # GET - Available slots
    try:
        tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        resp = requests.get(f"{API_BASE}/slots/available?date={tomorrow}", timeout=10)
        if resp.status_code != 200:
            print_test("Slots - Available", False, f"Status {resp.status_code}")
            all_passed = False
        else:
            data = resp.json()
            slots = data.get('slots', [])
            
            # Should only include active slots (our created one is inactive now)
            inactive_slots = [s for s in slots if not s.get('active')]
            if inactive_slots:
                print_test("Slots - Available (Active Only)", False, f"Found {len(inactive_slots)} inactive slots")
                all_passed = False
            else:
                # Check structure (booked & available)
                if slots:
                    slot = slots[0]
                    if 'booked' not in slot or 'available' not in slot:
                        print_test("Slots - Available Structure", False, "Missing booked/available")
                        all_passed = False
                    elif slot.get('available', -1) < 0:
                        print_test("Slots - Available Count", False, "available < 0")
                        all_passed = False
                    else:
                        print_test("Slots - Available", True, f"{len(slots)} active slots with booked/available counts")
                else:
                    print_test("Slots - Available", True, "No active slots (expected if all inactive)")
    except Exception as e:
        print_test("Slots - Available", False, f"Exception: {str(e)}")
        all_passed = False
    
    # DELETE - Remove slot
    try:
        resp = requests.delete(f"{API_BASE}/slots/{created_slot_id}", timeout=10)
        if resp.status_code != 200:
            print_test("Slots - Delete", False, f"Status {resp.status_code}")
            all_passed = False
        else:
            print_test("Slots - Delete", True, f"Deleted slot {created_slot_id}")
        
        # Verify deletion
        resp = requests.get(f"{API_BASE}/slots", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            slots = data.get('slots', [])
            if any(s.get('id') == created_slot_id for s in slots):
                print_test("Slots - Delete Verification", False, "Slot still exists")
                all_passed = False
            else:
                print_test("Slots - Delete Verification", True, "Slot removed from list")
    except Exception as e:
        print_test("Slots - Delete", False, f"Exception: {str(e)}")
        all_passed = False
    
    return all_passed

def test_settings():
    """Test 7: Shop Settings GET/PUT"""
    print("=" * 80)
    print("TEST 7: Shop Settings")
    print("=" * 80)
    
    all_passed = True
    
    # GET - Retrieve settings
    try:
        resp = requests.get(f"{API_BASE}/settings", timeout=10)
        if resp.status_code != 200:
            print_test("Settings - Get", False, f"Status {resp.status_code}")
            all_passed = False
        else:
            data = resp.json()
            settings = data.get('settings', {})
            
            # Check required keys
            required = [
                'shopName', 'contactPhone', 'contactEmail', 'address',
                'deliveryCharge', 'freeDeliveryAbove', 'minOrderValue',
                'businessHours', 'slotsEnabled'
            ]
            missing = [k for k in required if k not in settings]
            if missing:
                print_test("Settings - Required Keys", False, f"Missing: {missing}")
                all_passed = False
            else:
                # Check businessHours structure
                bh = settings.get('businessHours', {})
                if 'open' not in bh or 'close' not in bh:
                    print_test("Settings - Business Hours", False, "Missing open/close")
                    all_passed = False
                else:
                    print_test("Settings - Get", True, f"shopName={settings.get('shopName')}, slotsEnabled={settings.get('slotsEnabled')}")
    except Exception as e:
        print_test("Settings - Get", False, f"Exception: {str(e)}")
        all_passed = False
    
    # PUT - Update settings
    try:
        update_payload = {
            "shopName": "ChemistShop Premium",
            "deliveryCharge": 59,
            "slotsEnabled": False
        }
        resp = requests.put(f"{API_BASE}/settings", json=update_payload, timeout=10)
        if resp.status_code != 200:
            print_test("Settings - Update", False, f"Status {resp.status_code}")
            all_passed = False
        else:
            data = resp.json()
            settings = data.get('settings', {})
            
            # Verify changes
            if settings.get('shopName') != "ChemistShop Premium" or settings.get('deliveryCharge') != 59 or settings.get('slotsEnabled') != False:
                print_test("Settings - Update", False, "Changes not applied")
                all_passed = False
            else:
                print_test("Settings - Update", True, "shopName, deliveryCharge, slotsEnabled updated")
        
        # Verify persistence
        resp = requests.get(f"{API_BASE}/settings", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            settings = data.get('settings', {})
            if settings.get('shopName') == "ChemistShop Premium" and settings.get('deliveryCharge') == 59:
                print_test("Settings - Update Persistence", True, "Changes persisted")
            else:
                print_test("Settings - Update Persistence", False, "Changes not persisted")
                all_passed = False
    except Exception as e:
        print_test("Settings - Update", False, f"Exception: {str(e)}")
        all_passed = False
    
    # Restore slotsEnabled for downstream tests
    try:
        restore_payload = {"slotsEnabled": True}
        resp = requests.put(f"{API_BASE}/settings", json=restore_payload, timeout=10)
        if resp.status_code == 200:
            print_test("Settings - Restore slotsEnabled", True, "Restored slotsEnabled=true")
        else:
            print_test("Settings - Restore slotsEnabled", False, f"Status {resp.status_code}")
            all_passed = False
    except Exception as e:
        print_test("Settings - Restore", False, f"Exception: {str(e)}")
        all_passed = False
    
    return all_passed

def main():
    print("\n" + "=" * 80)
    print("BACKEND API TEST SUITE - NEW ADMIN PANEL ENDPOINTS")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print(f"API Base: {API_BASE}")
    print("=" * 80 + "\n")
    
    results = {}
    
    # Run all tests
    results['Admin Stats'] = test_admin_stats()
    results['Admin Revenue'] = test_admin_revenue()
    results['Admin Orders'] = test_admin_orders()
    results['Products CRUD'] = test_products_crud()
    results['Order Status Update'] = test_order_status_update()
    results['Slots CRUD'] = test_slots_crud()
    results['Settings'] = test_settings()
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    total = len(results)
    passed = sum(1 for v in results.values() if v)
    print(f"\nTotal: {passed}/{total} test sections passed")
    print("=" * 80 + "\n")
    
    return all(results.values())

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
