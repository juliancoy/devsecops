import requests
import webbrowser
from typing import Dict, Optional
from urllib.parse import urlencode, urlparse, parse_qs

# Matrix credentials
MATRIX_HOMESERVER = "https://matrix.app.codecollective.us"  # Replace with your homeserver
REDIRECT_URL = "http://localhost:8000/callback"  # Replace with your callback URL

# Global Matrix access token
matrix_access_token: Optional[str] = None


def get_supported_login_types() -> Optional[Dict]:
    """
    Fetch the supported login types from the Matrix homeserver.
    """
    login_url = f"{MATRIX_HOMESERVER}/_matrix/client/v3/login"
    try:
        response = requests.get(login_url)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Failed to fetch login types: {e}")
        return None


def initiate_sso_login(redirect_url: str) -> bool:
    """
    Initiate SSO login by redirecting the user to the SSO interface.
    """
    sso_redirect_url = f"{MATRIX_HOMESERVER}/_matrix/client/v3/login/sso/redirect"
    params = {"redirectUrl": redirect_url}
    full_url = f"{sso_redirect_url}?{urlencode(params)}"

    print(f"Opening browser for SSO login: {full_url}")
    webbrowser.open(full_url)

    # Wait for the user to complete the SSO flow
    input("Press Enter after completing SSO login in the browser...")
    return True


def handle_callback(url: str) -> Optional[str]:
    """
    Handle the callback from the SSO provider and extract the loginToken.
    """
    parsed_url = urlparse(url)
    query_params = parse_qs(parsed_url.query)
    login_token = query_params.get("loginToken", [None])[0]

    if not login_token:
        print("No loginToken found in callback URL.")
        return None

    print("Received loginToken from SSO provider.")
    return login_token


def exchange_login_token_for_access_token(login_token: str) -> Optional[str]:
    """
    Exchange the loginToken for an access token by calling the /login endpoint.
    """
    login_url = f"{MATRIX_HOMESERVER}/_matrix/client/v3/login"
    payload = {
        "type": "m.login.token",
        "token": login_token,
    }

    try:
        response = requests.post(login_url, json=payload)
        response.raise_for_status()
        return response.json().get("access_token")
    except requests.exceptions.RequestException as e:
        print(f"Failed to exchange loginToken for access token: {e}")
        return None


def main():
    global matrix_access_token

    # Step 1: Fetch supported login types
    login_types = get_supported_login_types()
    if not login_types:
        return

    # Check if SSO is supported
    sso_supported = any(flow.get("type") == "m.login.sso" for flow in login_types.get("flows", []))
    if not sso_supported:
        print("SSO login is not supported by the homeserver.")
        return

    # Step 2: Initiate SSO login
    if not initiate_sso_login(REDIRECT_URL):
        return

    # Step 3: Handle the callback (simulated here by user input)
    callback_url = input("Paste the callback URL here: ")
    login_token = handle_callback(callback_url)
    if not login_token:
        return

    # Step 4: Exchange the loginToken for an access token
    matrix_access_token = exchange_login_token_for_access_token(login_token)
    if not matrix_access_token:
        return

    print("Logged in successfully!")
    print("Matrix access token:", matrix_access_token)


if __name__ == "__main__":
    main()