#!/usr/bin/env python3
"""
Backend API Testing for ChemistShop Pharmacy Ecommerce
Tests all endpoints at /api/* on Next.js full-stack app
"""

import requests
import json
import sys
from datetime import datetime

# Base URL from environment
BASE_URL = "https://chemist-refresh.preview.emergentagent.com/api"
TEST_USER_ID = "u-testuser"

# Test results tracking
test_results = []

def log_test(endpoint, status, reason):
    """Log test result"""
    result = f"{'✅ PASS' if status else '❌ FAIL'}: {endpoint} - {reason}"
    print(result)
    test_results.append({
        'endpoint': endpoint,
        'status': status,
        'reason': reason
    })
    return status

def test_health():
    """Test 1: GET /api/health"""
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        data = response.json()
        
        if response.status_code == 200 and data.get('ok') == True and 'service' in data and 'time' in data:
            return log_test("GET /api/health", True, f"Returns ok:true, service:{data.get('service')}, time present")
        else:
            return log_test("GET /api/health", False, f"Status {response.status_code}, data: {data}")
    except Exception as e:
        return log_test("GET /api/health", False, f"Exception: {str(e)}")

def test_categories():
    """Test 2: GET /api/categories"""
    try:
        response = requests.get(f"{BASE_URL}/categories", timeout=10)
        data = response.json()
        
        if response.status_code == 200 and 'categories' in data:
            categories = data['categories']
            if len(categories) == 8:
                # Check if categories have required fields
                first_cat = categories[0]
                if 'id' in first_cat and 'name' in first_cat and 'icon' in first_cat and 'color' in first_cat:
                    return log_test("GET /api/categories", True, f"Returns 8 categories with id/name/icon/color")
                else:
                    return log_test("GET /api/categories", False, f"Categories missing required fields")
            else:
                return log_test("GET /api/categories", False, f"Expected 8 categories, got {len(categories)}")
        else:
            return log_test("GET /api/categories", False, f"Status {response.status_code}, data: {data}")
    except Exception as e:
        return log_test("GET /api/categories", False, f"Exception: {str(e)}")

def test_products_list():
    """Test 3: GET /api/products - auto-seeds 30 products"""
    try:
        response = requests.get(f"{BASE_URL}/products", timeout=10)
        data = response.json()
        
        if response.status_code == 200 and 'products' in data and 'total' in data:
            products = data['products']
            if len(products) >= 30:
                return log_test("GET /api/products", True, f"Returns {len(products)} products with total field (auto-seeded)")
            else:
                return log_test("GET /api/products", False, f"Expected at least 30 products, got {len(products)}")
        else:
            return log_test("GET /api/products", False, f"Status {response.status_code}, data: {data}")
    except Exception as e:
        return log_test("GET /api/products", False, f"Exception: {str(e)}")

def test_products_filter_category():
    """Test 3a: GET /api/products?category=medicines"""
    try:
        response = requests.get(f"{BASE_URL}/products?category=medicines", timeout=10)
        data = response.json()
        
        if response.status_code == 200 and 'products' in data:
            products = data['products']
            # Verify all products are medicines
            all_medicines = all(p.get('category') == 'medicines' for p in products)
            if all_medicines and len(products) > 0:
                return log_test("GET /api/products?category=medicines", True, f"Returns {len(products)} medicines only")
            elif len(products) == 0:
                return log_test("GET /api/products?category=medicines", False, "No medicines found in products")
            else:
                return log_test("GET /api/products?category=medicines", False, "Some products are not medicines")
        else:
            return log_test("GET /api/products?category=medicines", False, f"Status {response.status_code}")
    except Exception as e:
        return log_test("GET /api/products?category=medicines", False, f"Exception: {str(e)}")

def test_products_search():
    """Test 3b: GET /api/products?search=crocin (case-insensitive)"""
    try:
        response = requests.get(f"{BASE_URL}/products?search=crocin", timeout=10)
        data = response.json()
        
        if response.status_code == 200 and 'products' in data:
            products = data['products']
            # Verify all products contain 'crocin' (case-insensitive)
            if len(products) > 0:
                all_match = all('crocin' in p.get('name', '').lower() for p in products)
                if all_match:
                    return log_test("GET /api/products?search=crocin", True, f"Returns {len(products)} products matching 'crocin' (case-insensitive)")
                else:
                    return log_test("GET /api/products?search=crocin", False, "Some products don't match search term")
            else:
                return log_test("GET /api/products?search=crocin", True, "No products match 'crocin' (acceptable if not in seed data)")
        else:
            return log_test("GET /api/products?search=crocin", False, f"Status {response.status_code}")
    except Exception as e:
        return log_test("GET /api/products?search=crocin", False, f"Exception: {str(e)}")

def test_products_sort():
    """Test 3c: GET /api/products?sort=price_asc,price_desc,rating,discount"""
    results = []
    
    # Test price_asc
    try:
        response = requests.get(f"{BASE_URL}/products?sort=price_asc&limit=5", timeout=10)
        data = response.json()
        if response.status_code == 200 and 'products' in data:
            products = data['products']
            if len(products) >= 2:
                prices = [p.get('price', 0) for p in products]
                is_sorted = all(prices[i] <= prices[i+1] for i in range(len(prices)-1))
                results.append(log_test("GET /api/products?sort=price_asc", is_sorted, f"Price ascending: {prices[:3]}..."))
            else:
                results.append(log_test("GET /api/products?sort=price_asc", False, "Not enough products to verify sorting"))
        else:
            results.append(log_test("GET /api/products?sort=price_asc", False, f"Status {response.status_code}"))
    except Exception as e:
        results.append(log_test("GET /api/products?sort=price_asc", False, f"Exception: {str(e)}"))
    
    # Test price_desc
    try:
        response = requests.get(f"{BASE_URL}/products?sort=price_desc&limit=5", timeout=10)
        data = response.json()
        if response.status_code == 200 and 'products' in data:
            products = data['products']
            if len(products) >= 2:
                prices = [p.get('price', 0) for p in products]
                is_sorted = all(prices[i] >= prices[i+1] for i in range(len(prices)-1))
                results.append(log_test("GET /api/products?sort=price_desc", is_sorted, f"Price descending: {prices[:3]}..."))
            else:
                results.append(log_test("GET /api/products?sort=price_desc", False, "Not enough products"))
        else:
            results.append(log_test("GET /api/products?sort=price_desc", False, f"Status {response.status_code}"))
    except Exception as e:
        results.append(log_test("GET /api/products?sort=price_desc", False, f"Exception: {str(e)}"))
    
    # Test rating
    try:
        response = requests.get(f"{BASE_URL}/products?sort=rating&limit=5", timeout=10)
        data = response.json()
        if response.status_code == 200 and 'products' in data:
            products = data['products']
            if len(products) >= 2:
                ratings = [p.get('rating', 0) for p in products]
                is_sorted = all(ratings[i] >= ratings[i+1] for i in range(len(ratings)-1))
                results.append(log_test("GET /api/products?sort=rating", is_sorted, f"Rating descending: {ratings[:3]}..."))
            else:
                results.append(log_test("GET /api/products?sort=rating", False, "Not enough products"))
        else:
            results.append(log_test("GET /api/products?sort=rating", False, f"Status {response.status_code}"))
    except Exception as e:
        results.append(log_test("GET /api/products?sort=rating", False, f"Exception: {str(e)}"))
    
    # Test discount (sorts by mrp desc)
    try:
        response = requests.get(f"{BASE_URL}/products?sort=discount&limit=5", timeout=10)
        data = response.json()
        if response.status_code == 200 and 'products' in data:
            products = data['products']
            if len(products) >= 2:
                mrps = [p.get('mrp', 0) for p in products]
                is_sorted = all(mrps[i] >= mrps[i+1] for i in range(len(mrps)-1))
                results.append(log_test("GET /api/products?sort=discount", is_sorted, f"MRP descending: {mrps[:3]}..."))
            else:
                results.append(log_test("GET /api/products?sort=discount", False, "Not enough products"))
        else:
            results.append(log_test("GET /api/products?sort=discount", False, f"Status {response.status_code}"))
    except Exception as e:
        results.append(log_test("GET /api/products?sort=discount", False, f"Exception: {str(e)}"))
    
    return all(results)

def test_products_limit():
    """Test 3d: GET /api/products?limit=5"""
    try:
        response = requests.get(f"{BASE_URL}/products?limit=5", timeout=10)
        data = response.json()
        
        if response.status_code == 200 and 'products' in data:
            products = data['products']
            if len(products) == 5:
                return log_test("GET /api/products?limit=5", True, f"Returns exactly 5 products")
            else:
                return log_test("GET /api/products?limit=5", False, f"Expected 5 products, got {len(products)}")
        else:
            return log_test("GET /api/products?limit=5", False, f"Status {response.status_code}")
    except Exception as e:
        return log_test("GET /api/products?limit=5", False, f"Exception: {str(e)}")

def test_product_detail():
    """Test 4: GET /api/products/:id (using p-007 BP Monitor)"""
    try:
        response = requests.get(f"{BASE_URL}/products/p-007", timeout=10)
        data = response.json()
        
        if response.status_code == 200 and 'product' in data and 'related' in data:
            product = data['product']
            related = data['related']
            
            # Verify product has correct id
            if product.get('id') == 'p-007':
                # Verify related items are same category but exclude self
                product_category = product.get('category')
                related_valid = all(r.get('category') == product_category and r.get('id') != 'p-007' for r in related)
                
                if related_valid:
                    return log_test("GET /api/products/p-007", True, f"Returns product + {len(related)} related items (same category, excludes self)")
                else:
                    return log_test("GET /api/products/p-007", False, "Related items validation failed")
            else:
                return log_test("GET /api/products/p-007", False, f"Wrong product id: {product.get('id')}")
        else:
            return log_test("GET /api/products/p-007", False, f"Status {response.status_code}, data: {data}")
    except Exception as e:
        return log_test("GET /api/products/p-007", False, f"Exception: {str(e)}")

def test_product_not_found():
    """Test 4a: GET /api/products/:id with non-existent id"""
    try:
        response = requests.get(f"{BASE_URL}/products/non-existent-id-12345", timeout=10)
        
        if response.status_code == 404:
            return log_test("GET /api/products/non-existent-id", True, "Returns 404 for non-existent product")
        else:
            return log_test("GET /api/products/non-existent-id", False, f"Expected 404, got {response.status_code}")
    except Exception as e:
        return log_test("GET /api/products/non-existent-id", False, f"Exception: {str(e)}")

def test_create_order():
    """Test 5: POST /api/orders"""
    try:
        order_data = {
            "userId": TEST_USER_ID,
            "items": [
                {
                    "id": "p-007",
                    "name": "BP Monitor",
                    "price": 1299,
                    "mrp": 1999,
                    "image": "/images/bp-monitor.jpg",
                    "qty": 1
                }
            ],
            "address": {
                "name": "John Doe",
                "phone": "9876543210",
                "line1": "123 Medical Street",
                "city": "Mumbai",
                "state": "Maharashtra",
                "pincode": "400001",
                "type": "home"
            },
            "payment": "COD",
            "subtotal": 1299,
            "discount": 0,
            "deliveryFee": 50,
            "total": 1349
        }
        
        response = requests.post(f"{BASE_URL}/orders", json=order_data, timeout=10)
        data = response.json()
        
        if response.status_code == 200 and 'order' in data:
            order = data['order']
            
            # Verify order structure
            checks = [
                order.get('id', '').startswith('ORD-'),
                order.get('status') == 'Confirmed',
                'trackingSteps' in order and isinstance(order['trackingSteps'], list),
                'estimatedDelivery' in order,
                order.get('userId') == TEST_USER_ID
            ]
            
            if all(checks):
                # Store order id for later tests
                global created_order_id
                created_order_id = order['id']
                return log_test("POST /api/orders", True, f"Created order {order['id']} with status 'Confirmed', tracking steps, estimated delivery")
            else:
                return log_test("POST /api/orders", False, f"Order structure validation failed: {order}")
        else:
            return log_test("POST /api/orders", False, f"Status {response.status_code}, data: {data}")
    except Exception as e:
        return log_test("POST /api/orders", False, f"Exception: {str(e)}")

def test_list_orders():
    """Test 6: GET /api/orders?userId=u-testuser"""
    try:
        response = requests.get(f"{BASE_URL}/orders?userId={TEST_USER_ID}", timeout=10)
        data = response.json()
        
        if response.status_code == 200 and 'orders' in data:
            orders = data['orders']
            
            # Check if the created order is in the list
            if len(orders) > 0:
                # Look for our created order
                found = any(o.get('userId') == TEST_USER_ID for o in orders)
                if found:
                    return log_test("GET /api/orders?userId", True, f"Returns {len(orders)} orders for user {TEST_USER_ID}")
                else:
                    return log_test("GET /api/orders?userId", False, "Created order not found in list")
            else:
                return log_test("GET /api/orders?userId", False, "No orders returned (expected at least one)")
        else:
            return log_test("GET /api/orders?userId", False, f"Status {response.status_code}")
    except Exception as e:
        return log_test("GET /api/orders?userId", False, f"Exception: {str(e)}")

def test_get_order():
    """Test 7: GET /api/orders/:id"""
    try:
        if 'created_order_id' not in globals():
            return log_test("GET /api/orders/:id", False, "No order id available (create order test may have failed)")
        
        response = requests.get(f"{BASE_URL}/orders/{created_order_id}", timeout=10)
        data = response.json()
        
        if response.status_code == 200 and 'order' in data:
            order = data['order']
            if order.get('id') == created_order_id:
                return log_test("GET /api/orders/:id", True, f"Returns order {created_order_id}")
            else:
                return log_test("GET /api/orders/:id", False, f"Wrong order returned: {order.get('id')}")
        else:
            return log_test("GET /api/orders/:id", False, f"Status {response.status_code}")
    except Exception as e:
        return log_test("GET /api/orders/:id", False, f"Exception: {str(e)}")

def test_create_prescription():
    """Test 8: POST /api/prescriptions"""
    try:
        prescription_data = {
            "userId": TEST_USER_ID,
            "patientName": "Jane Smith",
            "phone": "9876543210",
            "notes": "Need medicines for fever and cold",
            "fileName": "prescription_jan2026.pdf",
            "fileDataUrl": "data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvTWVkaWFCb3hbMCAwIDYxMiA3OTJdL1BhcmVudCAyIDAgUi9SZXNvdXJjZXM8PD4+Pj4KZW5kb2JqCnhyZWYKMCA0CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMDY0IDAwMDAwIG4gCjAwMDAwMDAxMjEgMDAwMDAgbiAKdHJhaWxlcgo8PC9TaXplIDQvUm9vdCAxIDAgUj4+CnN0YXJ0eHJlZgoyMTQKJSVFT0YK"
        }
        
        response = requests.post(f"{BASE_URL}/prescriptions", json=prescription_data, timeout=10)
        data = response.json()
        
        if response.status_code == 200 and 'prescription' in data:
            prescription = data['prescription']
            
            # Verify prescription structure
            checks = [
                prescription.get('id', '').startswith('RX-'),
                prescription.get('status') == 'Under Review',
                prescription.get('userId') == TEST_USER_ID,
                'fileDataUrl' not in prescription  # Should NOT include fileDataUrl in response
            ]
            
            if all(checks):
                # Store prescription id for later tests
                global created_prescription_id
                created_prescription_id = prescription['id']
                return log_test("POST /api/prescriptions", True, f"Created prescription {prescription['id']} with status 'Under Review', fileDataUrl NOT in response")
            else:
                return log_test("POST /api/prescriptions", False, f"Prescription validation failed: {prescription}")
        else:
            return log_test("POST /api/prescriptions", False, f"Status {response.status_code}, data: {data}")
    except Exception as e:
        return log_test("POST /api/prescriptions", False, f"Exception: {str(e)}")

def test_list_prescriptions():
    """Test 9: GET /api/prescriptions?userId=u-testuser"""
    try:
        response = requests.get(f"{BASE_URL}/prescriptions?userId={TEST_USER_ID}", timeout=10)
        data = response.json()
        
        if response.status_code == 200 and 'prescriptions' in data:
            prescriptions = data['prescriptions']
            
            if len(prescriptions) > 0:
                # Look for our created prescription
                found = any(p.get('userId') == TEST_USER_ID for p in prescriptions)
                if found:
                    return log_test("GET /api/prescriptions?userId", True, f"Returns {len(prescriptions)} prescriptions for user {TEST_USER_ID}")
                else:
                    return log_test("GET /api/prescriptions?userId", False, "Created prescription not found")
            else:
                return log_test("GET /api/prescriptions?userId", False, "No prescriptions returned (expected at least one)")
        else:
            return log_test("GET /api/prescriptions?userId", False, f"Status {response.status_code}")
    except Exception as e:
        return log_test("GET /api/prescriptions?userId", False, f"Exception: {str(e)}")

def test_create_address():
    """Test 10: POST /api/addresses"""
    try:
        address_data = {
            "userId": TEST_USER_ID,
            "name": "Alice Johnson",
            "phone": "9123456789",
            "line1": "456 Health Avenue, Apt 5B",
            "city": "Delhi",
            "state": "Delhi",
            "pincode": "110001",
            "type": "work"
        }
        
        response = requests.post(f"{BASE_URL}/addresses", json=address_data, timeout=10)
        data = response.json()
        
        if response.status_code == 200 and 'address' in data:
            address = data['address']
            
            # Verify address structure
            if address.get('id', '').startswith('ADDR-') and address.get('userId') == TEST_USER_ID:
                # Store address id for later tests
                global created_address_id
                created_address_id = address['id']
                return log_test("POST /api/addresses", True, f"Created address {address['id']} with id starting 'ADDR-'")
            else:
                return log_test("POST /api/addresses", False, f"Address validation failed: {address}")
        else:
            return log_test("POST /api/addresses", False, f"Status {response.status_code}, data: {data}")
    except Exception as e:
        return log_test("POST /api/addresses", False, f"Exception: {str(e)}")

def test_list_addresses():
    """Test 11: GET /api/addresses?userId=u-testuser"""
    try:
        response = requests.get(f"{BASE_URL}/addresses?userId={TEST_USER_ID}", timeout=10)
        data = response.json()
        
        if response.status_code == 200 and 'addresses' in data:
            addresses = data['addresses']
            
            if len(addresses) > 0:
                # Look for our created address
                found = any(a.get('userId') == TEST_USER_ID for a in addresses)
                if found:
                    return log_test("GET /api/addresses?userId", True, f"Returns {len(addresses)} addresses for user {TEST_USER_ID}")
                else:
                    return log_test("GET /api/addresses?userId", False, "Created address not found")
            else:
                return log_test("GET /api/addresses?userId", False, "No addresses returned (expected at least one)")
        else:
            return log_test("GET /api/addresses?userId", False, f"Status {response.status_code}")
    except Exception as e:
        return log_test("GET /api/addresses?userId", False, f"Exception: {str(e)}")

def test_delete_address():
    """Test 12: DELETE /api/addresses/:id"""
    try:
        if 'created_address_id' not in globals():
            return log_test("DELETE /api/addresses/:id", False, "No address id available (create address test may have failed)")
        
        response = requests.delete(f"{BASE_URL}/addresses/{created_address_id}", timeout=10)
        data = response.json()
        
        if response.status_code == 200 and data.get('ok') == True:
            # Verify address is deleted by trying to fetch it
            list_response = requests.get(f"{BASE_URL}/addresses?userId={TEST_USER_ID}", timeout=10)
            list_data = list_response.json()
            
            if 'addresses' in list_data:
                addresses = list_data['addresses']
                still_exists = any(a.get('id') == created_address_id for a in addresses)
                
                if not still_exists:
                    return log_test("DELETE /api/addresses/:id", True, f"Deleted address {created_address_id}, verified not in list")
                else:
                    return log_test("DELETE /api/addresses/:id", False, "Address still exists after deletion")
            else:
                return log_test("DELETE /api/addresses/:id", True, f"Deleted address {created_address_id} (ok:true)")
        else:
            return log_test("DELETE /api/addresses/:id", False, f"Status {response.status_code}, data: {data}")
    except Exception as e:
        return log_test("DELETE /api/addresses/:id", False, f"Exception: {str(e)}")

def test_cors_preflight():
    """Test 13: OPTIONS preflight (CORS)"""
    try:
        response = requests.options(f"{BASE_URL}/products", timeout=10)
        
        if response.status_code == 204:
            headers = response.headers
            cors_origin = headers.get('Access-Control-Allow-Origin')
            
            if cors_origin == '*':
                return log_test("OPTIONS /api/* (CORS)", True, f"Returns 204 with Access-Control-Allow-Origin: *")
            else:
                return log_test("OPTIONS /api/* (CORS)", False, f"CORS header: {cors_origin}")
        else:
            return log_test("OPTIONS /api/* (CORS)", False, f"Expected 204, got {response.status_code}")
    except Exception as e:
        return log_test("OPTIONS /api/* (CORS)", False, f"Exception: {str(e)}")

def main():
    """Run all backend tests"""
    print("=" * 80)
    print("ChemistShop Backend API Testing")
    print(f"Base URL: {BASE_URL}")
    print(f"Test User: {TEST_USER_ID}")
    print("=" * 80)
    print()
    
    # Run all tests in sequence
    test_health()
    test_categories()
    test_products_list()
    test_products_filter_category()
    test_products_search()
    test_products_sort()
    test_products_limit()
    test_product_detail()
    test_product_not_found()
    test_create_order()
    test_list_orders()
    test_get_order()
    test_create_prescription()
    test_list_prescriptions()
    test_create_address()
    test_list_addresses()
    test_delete_address()
    test_cors_preflight()
    
    # Summary
    print()
    print("=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for r in test_results if r['status'])
    failed = sum(1 for r in test_results if not r['status'])
    total = len(test_results)
    
    print(f"Total: {total} | Passed: {passed} | Failed: {failed}")
    print()
    
    if failed > 0:
        print("FAILED TESTS:")
        for r in test_results:
            if not r['status']:
                print(f"  ❌ {r['endpoint']}: {r['reason']}")
        print()
    
    print("=" * 80)
    
    # Exit with appropriate code
    sys.exit(0 if failed == 0 else 1)

if __name__ == "__main__":
    main()
