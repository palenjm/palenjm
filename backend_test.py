#!/usr/bin/env python3

import requests
import sys
import json
import time
from datetime import datetime
import tempfile
import os

class DMRSAPITester:
    def __init__(self, base_url="https://dmrs-nemsu.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.uploaded_doc_id = None

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)
        
        if files:
            # Remove Content-Type for multipart/form-data
            test_headers.pop('Content-Type', None)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                if files:
                    response = requests.post(url, data=data, files=files, headers=test_headers, timeout=30)
                else:
                    response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            
            if success:
                self.log_test(name, True)
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                error_detail = f"Expected {expected_status}, got {response.status_code}"
                try:
                    error_detail += f" - {response.json()}"
                except:
                    error_detail += f" - {response.text[:200]}"
                self.log_test(name, False, error_detail)
                return False, {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_user_registration(self):
        """Test user registration"""
        timestamp = int(time.time())
        test_user_data = {
            "email": f"test_user_{timestamp}@nemsu.edu.ph",
            "password": "TestPass123!",
            "name": f"Test User {timestamp}",
            "role": "Faculty"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=test_user_data
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            return True
        return False

    def test_user_login(self):
        """Test user login with existing credentials"""
        # Try to login with the registered user
        if not hasattr(self, 'test_email'):
            return False
            
        login_data = {
            "email": self.test_email,
            "password": "TestPass123!"
        }
        
        success, response = self.run_test(
            "User Login",
            "POST", 
            "auth/login",
            200,
            data=login_data
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            return True
        return False

    def test_document_upload(self):
        """Test document upload"""
        if not self.token:
            self.log_test("Document Upload", False, "No authentication token")
            return False

        # Create a test PDF-like content
        test_content = "This is a test document for DMRS testing.\n\nContent includes:\n- Test data\n- Sample text\n- Document verification"
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write(test_content)
            temp_file_path = f.name

        try:
            with open(temp_file_path, 'rb') as f:
                files = {'file': ('test_document.txt', f, 'text/plain')}
                data = {
                    'title': 'Test Document for API Testing',
                    'document_type': 'Memorandum',
                    'access_level': 'Public'
                }
                
                success, response = self.run_test(
                    "Document Upload",
                    "POST",
                    "documents/upload",
                    200,
                    data=data,
                    files=files
                )
                
                if success and 'document_id' in response:
                    self.uploaded_doc_id = response['document_id']
                    return True
                return False
        finally:
            os.unlink(temp_file_path)

    def test_get_documents(self):
        """Test getting documents list"""
        success, response = self.run_test(
            "Get Documents List",
            "GET",
            "documents",
            200
        )
        return success

    def test_get_stats(self):
        """Test getting dashboard statistics"""
        success, response = self.run_test(
            "Get Dashboard Stats",
            "GET",
            "stats",
            200
        )
        
        if success:
            expected_keys = ['total_documents', 'your_documents', 'public_documents']
            for key in expected_keys:
                if key not in response:
                    self.log_test("Stats Response Format", False, f"Missing key: {key}")
                    return False
            self.log_test("Stats Response Format", True)
        return success

    def test_bm25_search(self):
        """Test BM25 search functionality"""
        search_data = {
            "query": "test document",
            "search_mode": "bm25"
        }
        
        success, response = self.run_test(
            "BM25 Search",
            "POST",
            "search",
            200,
            data=search_data
        )
        return success

    def test_semantic_search(self):
        """Test semantic search functionality"""
        search_data = {
            "query": "testing documentation",
            "search_mode": "semantic"
        }
        
        success, response = self.run_test(
            "Semantic Search",
            "POST",
            "search",
            200,
            data=search_data
        )
        return success

    def test_hybrid_search(self):
        """Test hybrid search functionality"""
        search_data = {
            "query": "memorandum document",
            "search_mode": "hybrid"
        }
        
        success, response = self.run_test(
            "Hybrid Search",
            "POST",
            "search",
            200,
            data=search_data
        )
        return success

    def test_chat_interface(self):
        """Test chat interface"""
        chat_data = {
            "message": "Show me documents about testing"
        }
        
        success, response = self.run_test(
            "Chat Interface",
            "POST",
            "chat",
            200,
            data=chat_data
        )
        
        if success:
            expected_keys = ['response', 'documents']
            for key in expected_keys:
                if key not in response:
                    self.log_test("Chat Response Format", False, f"Missing key: {key}")
                    return False
            self.log_test("Chat Response Format", True)
        return success

    def test_document_view(self):
        """Test viewing a specific document"""
        if not self.uploaded_doc_id:
            self.log_test("Document View", False, "No uploaded document ID available")
            return False
            
        success, response = self.run_test(
            "Document View",
            "GET",
            f"documents/{self.uploaded_doc_id}",
            200
        )
        return success

    def test_document_deletion(self):
        """Test document deletion"""
        if not self.uploaded_doc_id:
            self.log_test("Document Deletion", False, "No uploaded document ID available")
            return False
            
        success, response = self.run_test(
            "Document Deletion",
            "DELETE",
            f"documents/{self.uploaded_doc_id}",
            200
        )
        return success

    def test_invalid_search_mode(self):
        """Test invalid search mode handling"""
        search_data = {
            "query": "test",
            "search_mode": "invalid_mode"
        }
        
        success, response = self.run_test(
            "Invalid Search Mode",
            "POST",
            "search",
            400,
            data=search_data
        )
        return success

    def test_unauthorized_access(self):
        """Test unauthorized access"""
        # Temporarily remove token
        original_token = self.token
        self.token = None
        
        success, response = self.run_test(
            "Unauthorized Access",
            "GET",
            "documents",
            401
        )
        
        # Restore token
        self.token = original_token
        return success

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting DMRS API Testing...")
        print(f"📍 Testing against: {self.base_url}")
        print("=" * 60)
        
        # Authentication tests
        print("\n📋 Authentication Tests")
        if not self.test_user_registration():
            print("❌ Registration failed, stopping tests")
            return False
            
        # Core functionality tests
        print("\n📋 Document Management Tests")
        self.test_document_upload()
        self.test_get_documents()
        self.test_get_stats()
        
        # Search functionality tests
        print("\n📋 Search Functionality Tests")
        self.test_bm25_search()
        self.test_semantic_search()
        self.test_hybrid_search()
        self.test_chat_interface()
        
        # Document operations tests
        print("\n📋 Document Operations Tests")
        self.test_document_view()
        
        # Error handling tests
        print("\n📋 Error Handling Tests")
        self.test_invalid_search_mode()
        self.test_unauthorized_access()
        
        # Cleanup
        print("\n📋 Cleanup Tests")
        self.test_document_deletion()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return False

def main():
    tester = DMRSAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    results = {
        "timestamp": datetime.now().isoformat(),
        "total_tests": tester.tests_run,
        "passed_tests": tester.tests_passed,
        "success_rate": (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0,
        "test_details": tester.test_results
    }
    
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())