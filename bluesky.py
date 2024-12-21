#!/usr/bin/env python3
import os
import json
import secrets
import string
import requests
from typing import Optional

class AccountCreator:
    def __init__(self, PDS_HOSTNAME = "localhost", PDS_ADMIN_PASSWORD="changeme"):
        self.hostname = PDS_HOSTNAME
        self.admin_password = PDS_ADMIN_PASSWORD
        
        if not all([self.hostname, self.admin_password]):
            raise EnvironmentError("Missing required environment variables")
        
        # Load CA certificate into requests session
        self.session = requests.Session()
        self.session.verify = "./certs/ca.crt"

    def generate_password(self, length: int = 24) -> str:
        """Generate a secure random password."""
        alphabet = string.ascii_letters + string.digits
        # Remove potentially confusing characters
        alphabet = alphabet.translate(str.maketrans('', '', '=+/'))
        return ''.join(secrets.choice(alphabet) for _ in range(length))

    def create_invite_code(self) -> str:
        """Create a single-use invite code."""
        url = f"https://{self.hostname}/xrpc/com.atproto.server.createInviteCode"
        response = self.session.post(
            url,
            auth=('admin', self.admin_password),
            json={"useCount": 1}
        )
        response.raise_for_status()
        return response.json()['code']

    def create_account(self, email: str, handle: str) -> dict:
        """
        Create a new account with the given email and handle.
        
        Args:
            email: User's email address
            handle: Desired handle for the account
            
        Returns:
            dict containing account details including DID and password
        """
        # Generate password and invite code
        password = self.generate_password()
        invite_code = self.create_invite_code()
        
        # Create the account
        url = f"https://{self.hostname}/xrpc/com.atproto.server.createAccount"
        data = {
            "email": email,
            "handle": handle,
            "password": password,
            "inviteCode": invite_code
        }
        
        response = self.session.post(url, json=data)
        
        # Check for errors
        if response.status_code != 200:
            error_msg = response.json().get('message', 'Unknown error occurred')
            raise Exception(f"Account creation failed: {error_msg}")
            
        account_data = response.json()
        
        # Return account details including the generated password
        return {
            "handle": handle,
            "did": account_data['did'],
            "password": password
        }

def main(email = "alice@example.com", handle="alice.local.test"):
    creator = AccountCreator()
    
    # Create the account
    result = creator.create_account(email, handle)
    
    # Display results
    print("\nAccount created successfully!")
    print("-----------------------------")
    print(f"Handle   : {result['handle']}")
    print(f"DID      : {result['did']}")
    print(f"Password : {result['password']}")
    print("-----------------------------")
    print("Save this password, it will not be displayed again.")
    print()

if __name__ == "__main__":
    main()