#!/usr/bin/env python3
import os
import json
import secrets
import string
import requests
import env
from typing import Optional
from datetime import datetime, UTC

class ATProtoClient:
    def __init__(self, PDS_HOSTNAME=env.USER_WEBSITE, PDS_ADMIN_PASSWORD="changeme"):
        self.hostname = PDS_HOSTNAME
        self.admin_password = PDS_ADMIN_PASSWORD
        
        if not all([self.hostname, self.admin_password]):
            raise EnvironmentError("Missing required environment variables")
        
        self.session = requests.Session()
        self.auth_token = None
        self.did = None  # Store DID after login for post creation

    def generate_password(self, length: int = 24) -> str:
        """Generate a secure random password."""
        alphabet = string.ascii_letters + string.digits
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

    def check_handle_availability(self, handle: str) -> bool:
        """Check if a handle is available."""
        url = f"https://{self.hostname}/xrpc/com.atproto.identity.resolveHandle"
        try:
            response = self.session.get(url, params={"handle": handle})
            return False  # Handle exists
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 404:
                return True  # Handle is available
            raise

    def login(self, identifier: str, password: str) -> bool:
        """Log in to get an authentication token."""
        url = f"https://{self.hostname}/xrpc/com.atproto.server.createSession"
        try:
            response = self.session.post(
                url,
                json={"identifier": identifier, "password": password}
            )
            response.raise_for_status()
            session_data = response.json()
            self.auth_token = session_data.get('accessJwt')
            self.did = session_data.get('did')  # Store the DID
            return True
        except requests.exceptions.HTTPError:
            return False

    def create_account(self, email: str, handle: str) -> dict:
        """Create a new account with the given email and handle."""
        # Check if handle is available
        if not self.check_handle_availability(handle):
            raise ValueError(f"Handle '{handle}' is already taken")

        password = self.generate_password()
        invite_code = self.create_invite_code()
        
        url = f"https://{self.hostname}/xrpc/com.atproto.server.createAccount"
        data = {
            "email": email,
            "handle": handle,
            "password": password,
            "inviteCode": invite_code
        }
        
        response = self.session.post(url, json=data)
        
        if response.status_code != 200:
            error_msg = response.json().get('message', 'Unknown error occurred')
            raise Exception(f"Account creation failed: {error_msg}")
            
        account_data = response.json()
        
        return {
            "handle": handle,
            "did": account_data['did'],
            "password": password
        }

    def create_post(self, text: str, reply_to: Optional[str] = None) -> dict:
        """Create a new post."""
        if not self.auth_token or not self.did:
            raise ValueError("Must be logged in to create posts")

        url = f"https://{self.hostname}/xrpc/com.atproto.repo.createRecord"
        
        post_data = {
            "text": text,
            "createdAt": datetime.now(UTC).isoformat(),
            "$type": "app.bsky.feed.post"
        }
        
        if reply_to:
            post_data["reply"] = {"root": reply_to}

        data = {
            "repo": self.did,
            "collection": "app.bsky.feed.post",
            "record": post_data
        }

        headers = {"Authorization": f"Bearer {self.auth_token}"}
        response = self.session.post(url, json=data, headers=headers)
        response.raise_for_status()
        return response.json()

    def get_profile(self, handle: str) -> dict:
        """Get profile information for a handle."""
        url = f"https://{self.hostname}/xrpc/app.bsky.actor.getProfile"
        params = {"actor": handle}
        if self.auth_token:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = self.session.get(url, params=params, headers=headers)
        else:
            response = self.session.get(url, params=params)
        response.raise_for_status()
        return response.json()

def main(email="alice@" + env.USER_WEBSITE, handle="alice." + env.USER_WEBSITE):
    client = ATProtoClient()
    print(f"Checking account availability for handle {handle}")

    # Check if handle is available
    if not client.check_handle_availability(handle):
        print(f"Handle '{handle}' is already taken!")
        with open("aliceAccount.json") as f:
            result = json.loads(f.read())
    else:
        # Create the account
        result = client.create_account(email, handle)
    
        # Display results
        print("\nAccount created successfully!")
        print("-----------------------------")
        print(f"Handle   : {result['handle']}")
        print(f"DID      : {result['did']}")
        print(f"Password : {result['password']}")
        print("-----------------------------")
        print("Save this password, it will not be displayed again.")
    
    # Demo post creation
    if client.login(handle, result['password']):
        print("\nCreating demo post...")
        post_result = client.create_post("Hello, Bluesky! This is my first post.")
        print("Post created successfully!")
    else:
        print("Failed to login!")
        
if __name__ == "__main__":
    main()