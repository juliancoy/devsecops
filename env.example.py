import os
import requests
import json
import copy 
import util

# Check if the CURRENT_DIR environment variable is set (for Docker container case)
current_dir = os.getenv("CURRENT_DIR", os.path.abspath(os.path.dirname(__file__)))

print(f"Relative directory : {current_dir}")

keycloak_dir = os.path.join(current_dir, "keycloak")
opentdf_dir = os.path.join(current_dir, "opentdf")
nginx_dir = os.path.join(current_dir, "nginx")
webapp_dir = os.path.join(current_dir, "webapp")
org_dir = os.path.join(current_dir, "org")
certs_dir = os.path.join(current_dir, "certs")
keys_dir = os.path.join(current_dir, "certs", "keys")

# If you are running multiple deployments on the same machine, you can distinguish them here
distinguisher = ""

# Most common options to change
BRAND_NAME = "arkavo"
USER_WEBSITE = "localhost"
USER_EMAIL = "youremail@example.com"
PROTOCOL_USER_WEBSITE = "https://localhost"
TLD = ".us"
LOCAL_SERVER_mDNS = "localhost"
SERVICES_TO_RUN = [
    "keycloak",
    "org",
    "opentdf",
    "AICouncil",
    "nginx",
    "synapse",
    "ollama",
]

# Check to see if we're in an EC2 instance
ec2_metadata_base_url = "http://169.254.169.254/latest/meta-data/"
try:
    response = requests.get(ec2_metadata_base_url, timeout=1)
    response.raise_for_status()
    metadata_keys = response.text.splitlines()

    metadata = {}
    for key in metadata_keys:
        key_url = ec2_metadata_base_url + key
        key_response = requests.get(key_url, timeout=1)
        key_response.raise_for_status()
        metadata[key] = key_response.text

    print(json.dumps(metadata))
    IS_EC2 = True

except requests.RequestException as e:
    print("No EC2 Metadata. Assuming local deployment")
    IS_EC2 = False

# -- Locations of Services --
if IS_EC2:
    pass
else:
    KEYCLOAK_BASE_URL = "localhost/keycloak"
    OPENTDF_BASE_URL = "localhost/opentdf"
    VITE_PUBLIC_URL = "localhost"

# Git Branch Port Config
# BRANCH="$(git rev-parse --abbrev-ref HEAD)"

# Keycloak Config
KEYCLOAK_REALM = "opentdf"
KEYCLOAK_PROTOCOL = "https"
KEYCLOAK_PORT = ""  # if applicable
KEYCLOAK_INTERNAL_URL = "keycloak:8888/keycloak"
KEYCLOAK_INTERNAL_CHECK_ADDR = f"http://{KEYCLOAK_INTERNAL_URL}"
KEYCLOAK_INTERNAL_AUTH_URL = f"http://{KEYCLOAK_INTERNAL_URL}/auth"
KEYCLOAK_HOST = KEYCLOAK_PROTOCOL + "://" + KEYCLOAK_BASE_URL
VITE_KEYCLOAK_SERVER_URL = KEYCLOAK_HOST + "/auth"

KEYCLOAK_AUTH_URL = KEYCLOAK_HOST + "/auth"
VITE_KEYCLOAK_AUTH_ENDPOINT = (
    f"{KEYCLOAK_HOST}/auth/realms/{KEYCLOAK_REALM}/protocol/openid-connect/auth"
)
VITE_KEYCLOAK_TOKEN_ENDPOINT = (
    f"{KEYCLOAK_HOST}/auth/realms/{KEYCLOAK_REALM}/protocol/openid-connect/token"
)
VITE_KEYCLOAK_USERINFO_ENDPOINT = (
    f"{KEYCLOAK_HOST}/auth/realms/{KEYCLOAK_REALM}/protocol/openid-connect/userinfo"
)
KEYCLOAK_SERVER_URL_INTERNAL = "https://keycloak:8443/auth"
VITE_KEYCLOAK_CLIENT_ID = "web-client"
VITE_KEYCLOAK_REALM = KEYCLOAK_REALM
VITE_KAS_ENDPOINT = f"https://{OPENTDF_BASE_URL}/kas"
KEYCLOAK_ADMIN_PASSWORD = "changeme"  # Secrets

# Other ish
# Google OAuth Config
GOOGLE_CLIENT_SECRET = "<YOUR SECRET HERE>"
GOOGLE_SCOPES = "openid profile email"
GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_CLIENT_ID = "<YOUR GOOGLE OAUTH CLIENT ID>"

# GitHub OAuth Config
GITHUB_CLIENT_SECRET = "<YOUR SECRET HERE>"
GITHUB_CLIENT_ID = "<YOUR GITHUB OAUTH CLIENT ID>"
GITHUB_SCOPES = "openid profile email"
GITHUB_AUTH_ENDPOINT = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_ENDPOINT = "https://github.com/login/oauth/access_token"

PEM_FILE = "<YOUR SECRET HERE>"
SERVER_USER = "<YOUR SECRET HERE>"
SERVER_HOST = "<YOUR SECRET HERE>"
REMOTE_FOLDER = "<YOUR SECRET HERE>"
ZIP_FILE = "<YOUR SECRET HERE>"
LOCAL_DESTINATION = "<YOUR SECRET HERE>"
EXTRACT_FOLDER = "<YOUR SECRET HERE>"  # Name of the folder after extraction

# More public options
COMPOSE_PROJECT_NAME = BRAND_NAME
NETWORK_NAME = BRAND_NAME + distinguisher

# Admin Config
ADMIN_CLIENT = "admin-cli"
KEYCLOAK_ADMIN = "admin"

# EC2 Metadata Check
VITE_PUBLIC_URL_ON_EC2 = "localhost"

# Redirects
VITE_GOOGLE_REDIRECT_URI = f"https://{VITE_PUBLIC_URL}"
VITE_GITHUB_REDIRECT_URI = f"{VITE_PUBLIC_URL}"
VITE_KEYCLOAK_REDIRECT_URI = f"{VITE_PUBLIC_URL}"
KEYCLOAK_REDIRECT_URI = f"{VITE_KEYCLOAK_REDIRECT_URI}"
VITE_ORG_BACKEND_URL = "https://localhost/org"
VITE_FRONTEND_SERVER_URL = f"https://{VITE_PUBLIC_URL}"

# Opentdf config
opentdfdb = dict(
    image="postgres:15-alpine",
    detach=True,
    name="opentdfdb" + distinguisher,
    network=NETWORK_NAME,
    restart_policy={"Name": "always"},
    user="postgres",
    environment={
        "POSTGRES_PASSWORD": "changeme",
        "POSTGRES_USER": "postgres",
        "POSTGRES_DB": "opentdf",
    },
    volumes={
        "OPENTDF_POSTGRES"
        + distinguisher: {
            "bind": "/var/lib/postgresql/data",
            "mode": "rw",
        }
    },
    healthcheck={
        "test": ["CMD-SHELL", "pg_isready"],
        "interval": 5000000000,  # 5s in nanoseconds
        "timeout": 5000000000,  # 5s in nanoseconds
        "retries": 10,
    },
)

opentdf = dict(
    image="julianfl0w/opentdf:1.0",
    detach=True,
    command="start",
    name="opentdf",
    network=NETWORK_NAME,
    restart_policy={"Name": "always"},
    ports={"8080/tcp": 8080},
    environment={
        "KEYCLOAK_BASE_URL": KEYCLOAK_INTERNAL_AUTH_URL,
    },
    volumes={
        # f"{certs_dir}/all-ca-certificates.crt": {"bind": "/etc/ssl/certs/ca-certificates.crt", "mode": "ro"},
        f"{opentdf_dir}/opentdf.yaml": {"bind": "/app/opentdf.yaml", "mode": "ro"},
        f"{keys_dir}/kas-cert.pem": {"bind": "/keys/kas-cert.pem", "mode": "ro"},
        f"{keys_dir}/kas-ec-cert.pem": {"bind": "/keys/kas-ec-cert.pem", "mode": "ro"},
        f"{keys_dir}/kas-private.pem": {"bind": "/keys/kas-private.pem", "mode": "ro"},
        f"{keys_dir}/kas-ec-private.pem": {
            "bind": "/keys/kas-ec-private.pem",
            "mode": "ro",
        },
        # f"{keys_dir}/keycloak-ca.pem": {"bind": "/etc/ssl/certs/ca-certificates.crt", "mode": "ro"},
        f"{keys_dir}/keycloak-ca.pem": {
            "bind": "/usr/local/share/ca-certificates/ca-certificates.crt",
            "mode": "ro",
        },
        # Mount the CA key from nginx directory
        # f"{certs_dir}/ca.key": {"bind": "/app/nginx/ca.key", "mode": "ro"}
    },
    healthcheck={
        "test": ["CMD-SHELL", f"curl -sf {KEYCLOAK_AUTH_URL} || exit 1"],
        "interval": 10000000000,  # 10s in nanoseconds
        "timeout": 5000000000,  # 5s in nanoseconds
        "retries": 5,
    },
)


# Keycloak config
keycloakdb = copy.deepcopy(opentdfdb)
keycloakdb["name"] = "keycloakdb"
keycloakdb["environment"]["POSTGRES_DB"] = "keycloak"
keycloakdb["volumes"] = {
    "KEYCLOAK_POSTGRES"
    + distinguisher: {"bind": "/var/lib/postgresql/data", "mode": "rw"}
}

keycloak = {
    "name": "keycloak",
    "network": BRAND_NAME,
    "image": "cgr.dev/chainguard/keycloak@sha256:37895558d2e0e93ffff75da5900f9ae7e79ec6d1c390b18b2ecea6cee45ec26f",
    "entrypoint": "/opt/keycloak/keycloak-startup.sh",
    "detach": True,
    "restart_policy": {"Name": "always"},
    "volumes": {
        os.path.join(keys_dir, "localhost.crt"): {
            "bind": "/etc/x509/tls/localhost.crt",
            "mode": "ro",  # Read-only
        },
        os.path.join(keys_dir, "localhost.key"): {
            "bind": "/etc/x509/tls/localhost.key",
            "mode": "ro",  # Read-only
        },
        os.path.join(keys_dir, "ca.jks"): {
            "bind": "/truststore/truststore.jks",
            "mode": "ro",  # Read-only
        },
        os.path.join(keycloak_dir, "realms"): {
            "bind": "/opt/keycloak/realms",
            "mode": "ro",  # Read-only
        },
        os.path.join(keycloak_dir, "oauth_certs"): {
            "bind": "/opt/keycloak/oauth_certs",
            "mode": "ro",  # Read-only
        },
        os.path.join(keycloak_dir, "keycloak-startup.sh"): {
            "bind": "/opt/keycloak/keycloak-startup.sh",
            "mode": "ro",  # Read-only
        },
    },
    "environment": {
        "KC_PROXY": "edge",
        "PROXY_ADDRESS_FORWARDING": "true",
        "KC_HTTP_RELATIVE_PATH": "/keycloak/auth",
        "KC_DB_VENDOR": "postgres",
        "KC_DB_URL_HOST": "keycloakdb",
        "KC_DB_URL_PORT": "5432",
        "KC_DB_URL_DATABASE": "keycloak",
        "KC_DB_USERNAME": "postgres",
        "KC_DB_PASSWORD": "changeme",
        "KC_HOSTNAME_STRICT": "false",
        "KC_HOSTNAME_STRICT_BACKCHANNEL": "false",
        "KC_HOSTNAME_STRICT_HTTPS": "false",
        "KC_HTTP_ENABLED": "true",
        "KC_HTTP_PORT": "8888",
        "KC_HTTPS_PORT": "8443",
        "KEYCLOAK_ADMIN": KEYCLOAK_ADMIN,
        "KEYCLOAK_ADMIN_PASSWORD": KEYCLOAK_ADMIN_PASSWORD,
        "KEYCLOAK_FRONTEND_URL": KEYCLOAK_AUTH_URL,
        "KC_HOSTNAME_URL": KEYCLOAK_AUTH_URL,
        "KC_FEATURES": "preview,token-exchange",
        # "KC_LOG_LEVEL":"DEBUG",
        "KC_HEALTH_ENABLED": "true",
        "KC_HTTPS_KEY_STORE_PASSWORD": "password",
        "KC_HTTPS_KEY_STORE_FILE": "/truststore/truststore.jks",
        "KC_HTTPS_CERTIFICATE_FILE": "/etc/x509/tls/localhost.crt",
        "KC_HTTPS_CERTIFICATE_KEY_FILE": "/etc/x509/tls/localhost.key",
        "KC_HTTPS_CLIENT_AUTH": "request",
    },
}

nginx = dict(
    image="nginx:latest",
    name="nginx",
    detach=True,  # equivalent to -d
    network=NETWORK_NAME,
    restart_policy={"Name": "always"},
    volumes={
        os.path.join(nginx_dir, "nginx.conf"): {
            "bind": "/etc/nginx/nginx.conf",
            "mode": "rw",
        },
        os.path.join(certs_dir, "ssl"): {"bind": "/etc/nginx/ssl", "mode": "rw"},
        os.path.join(certs_dir, "html"): {
            "bind": "/usr/share/nginx/html",
            "mode": "rw",
        },
        f"{certs_dir}/fullchain.pem": {"bind": "/keys/fullchain.pem", "mode": "rw"},
        f"{certs_dir}/privkey.pem": {"bind": "/keys/privkey.pem", "mode": "rw"},
    },
    ports={
        "80/tcp": 80,  # equivalent to -p 80:80
        "443/tcp": 443,  # equivalent to -p 443:443
    },
)

webapp = dict(
    image="node:22",
    detach=True,  # Runs the container in detached mode
    name=f"webapp",
    network=NETWORK_NAME,
    restart_policy={"Name": "always"},
    volumes={webapp_dir: {"bind": "/usr/src/app", "mode": "rw"}},
    working_dir="/usr/src/app",
    ports={"5173": "3001"},
    environment={
        "NODE_ENV": "development",
        "VITE_KEYCLOAK_SERVER_URL": VITE_KEYCLOAK_SERVER_URL,
        "VITE_KEYCLOAK_REALM": VITE_KEYCLOAK_REALM,
        "VITE_KEYCLOAK_CLIENT_ID": VITE_KEYCLOAK_CLIENT_ID,
        "VITE_ORG_BACKEND_URL": VITE_ORG_BACKEND_URL,
        "VITE_KAS_ENDPOINT": VITE_KAS_ENDPOINT,
    },
    command="sh -c 'npm install && npm run dev'",
)

go_installs_dir = os.path.join(
    org_dir, "installs"
)  # Directory to hold Go installs on the host

org = dict(
    image="cosmtrek/air:latest",
    detach=True,  # Runs the container in detached mode
    name=f"org",
    network=NETWORK_NAME,
    restart_policy={"Name": "always"},
    ports={"8085": "8085"},
    volumes={
        org_dir: {"bind": "/usr/src/app", "mode": "rw"},
        go_installs_dir: {
            "bind": "/go/pkg/mod",
            "mode": "rw",
        },  # Volume for Go installs
        certs_dir: {"bind": "/certs", "mode": "rw"},
    },
    working_dir="/usr/src/app",
    environment={
        "ORG_BACKEND_URL": VITE_ORG_BACKEND_URL,
        "FRONTEND_URL": USER_WEBSITE,
        "ALLOWED_ORIGINS": f"{USER_WEBSITE},https://arkavo.ai",
        "KEYCLOAK_ADMIN": KEYCLOAK_ADMIN,
        "KEYCLOAK_ADMIN_PASSWORD": KEYCLOAK_ADMIN_PASSWORD,
        "KEYCLOAK_SERVER_URL": KEYCLOAK_INTERNAL_AUTH_URL,
    },
    command=["sh", "-c", "go build && ./main"],
)

synapse = dict(
    image="matrixdotorg/synapse:latest",
    detach=True,
    name="synapse",
    network=NETWORK_NAME,
    restart_policy={"Name": "always"},
    volumes={
        os.path.join(current_dir, "synapse"): {"bind": "/data", "mode": "rw"},
    },
    healthcheck={
        "test": ["CMD-SHELL", "curl -f http://localhost:8008/health || exit 1"],
        "interval": 5000000000,  # 5s
        "timeout": 5000000000,  # 5s
        "retries": 5,
    },
)

synapsedb = copy.deepcopy(opentdfdb)
synapsedb["name"] = "synapsedb"
synapsedb["environment"] = {
    "POSTGRES_PASSWORD": "changeme",
    "POSTGRES_USER": "postgres",
    "POSTGRES_DB": "synapse",
    "POSTGRES_INITDB_ARGS": "--encoding=UTF8 --lc-collate=C --lc-ctype=C",
}
synapsedb["volumes"] = {
    "SYNAPSE_POSTGRES"
    + distinguisher: {"bind": "/var/lib/postgresql/data", "mode": "rw"}
}


# Base configuration
ollama = {
    "name": "ollama",
    "detach": True,  # Runs the container in detached mode
    "volumes": {
        os.path.join(current_dir, "ollama", "ollama_models"): {
            "bind": "/root/.ollama/models",
            "mode": "rw",
        },
        os.path.join(current_dir, "ollama", "whisper_models"): {
            "bind": "/data/cache/whisper/models",
            "mode": "rw",
        },
    },
    "ports": {"11434/tcp": 11434},
    "environment": {
        "OLLAMA_ORIGINS": "*",
        "ENABLE_OLLAMA_API": "True",
        "DATA_DIR": "/data",
    },
    "image": "ollama/ollama",
}

# Check for NVIDIA GPU
if util.check_nvidia_gpu():
    ollama["deploy"] = {
        "resources": {
            "reservations": {
                "devices": [{"driver": "nvidia", "count": 1, "capabilities": ["gpu"]}]
            }
        }
    }
# Check for AMD GPU
elif util.check_amd_gpu():
    ollama["deploy"] = {
        "resources": {
            "reservations": {
                "devices": [{"driver": "amd", "count": 1, "capabilities": ["gpu"]}]
            }
        }
    }


# BLUESKY CRYPTO SETUP
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
import secrets

# Generate a secp256k1 private key
private_key = ec.generate_private_key(ec.SECP256K1())
private_key_bytes = private_key.private_numbers().private_value.to_bytes(
    32, byteorder="big"
)


bluesky = dict(
    image="ghcr.io/bluesky-social/pds:latest",
    detach=True,
    name="pds",
    network=NETWORK_NAME,  # Make sure it's on the same network as nginx
    volumes={
        "bluesky_pds": {"bind": "/pds", "mode": "rw"},
    },
    environment=dict(
        PDS_HOSTNAME=PROTOCOL_USER_WEBSITE,
        PDS_JWT_SECRET=secrets.token_hex(16),
        ADMIN_HANDLE="admin",
        ADMIN_USERNAME='admin',
        PDS_ADMIN_PASSWORD="changeme",
        PDS_PLC_ROTATION_KEY_K256_PRIVATE_KEY_HEX=private_key_bytes.hex(),
        PDS_DATA_DIRECTORY="/pds",
        PDS_BLOBSTORE_DISK_LOCATION="/pds/blocks",
        PDS_BLOB_UPLOAD_LIMIT=52428800,
        PDS_DID_PLC_URL="http://local.test:2582",
        PDS_BSKY_APP_VIEW_URL="http://local.test:2583",
        PDS_BSKY_APP_VIEW_DID="did:web:local.test:2583",
        PDS_REPORT_SERVICE_URL="http://local.test:3000",
        PDS_REPORT_SERVICE_DID="did:web:local.test:3000",
        PDS_CRAWLERS="http://local.test:4000",
        LOG_ENABLED=True,
    ),
)
