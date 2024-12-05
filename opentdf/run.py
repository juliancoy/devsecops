import time
import docker
from docker.errors import NotFound, APIError
import os
import sys 

# python should fix this
current_dir = os.path.abspath(os.path.dirname(__file__))
sys.path.insert(0, os.path.join(current_dir, '..'))
import utils_docker

# Initialize Docker client
client = docker.from_env()

def ensure_network(config):
    """Ensure the Docker network exists."""
    network_name = config["BRAND_NAME"]
    try:
        client.networks.get(network_name)
        print(f"Network {network_name} already exists.")
    except NotFound:
        client.networks.create(network_name)
        print(f"Network {network_name} created.")

def run_postgres_container(config):
    if utils_docker.containerRunning("opentdfdb"):
        return

    """Run the PostgreSQL container."""
    dbconfig = config["opentdfdb"]
    try:
        client.containers.run(
            'postgres:15-alpine',
            detach=True,
            name="opentdfdb",
            network=config["BRAND_NAME"],
            restart_policy={"Name": "always"},
            user="postgres",
            environment={
                "POSTGRES_USER": dbconfig["POSTGRES_USER"],
                "POSTGRES_PASSWORD": dbconfig["POSTGRES_PASSWORD"],
                "POSTGRES_DB": dbconfig["POSTGRES_DB"],
            },
            volumes={
                dbconfig["POSTGRES_DATA_VOLUME"]: {"bind": "/var/lib/postgresql/data", "mode": "rw"}
            },
            healthcheck={
                "test": ["CMD-SHELL", "pg_isready"],
                "interval": 5000000000,  # 5s in nanoseconds
                "timeout": 5000000000,  # 5s in nanoseconds
                "retries": 10,
            },
        )
        print("PostgreSQL container started.")
    except APIError as e:
        print(f"Error starting PostgreSQL container: {e}")

def run_opentdf_container(config):
    """Run the OpenTDF container."""
    try:
        client.containers.run(
            "julianfl0w/opentdf",
            detach=True,
            name="opentdf",
            network=config["BRAND_NAME"],
            restart_policy={"Name": "always"},
            ports={"8080/tcp": 8080},
            environment={"KEYCLOAK_BASE_URL": config["KEYCLOAK_SERVER_URL"]},
            volumes={
                f"{current_dir}/opentdf-dev.yaml": {"bind": "/app/opentdf.yaml", "mode": "ro"},
                f"{current_dir}": {"bind": "/keys", "mode": "ro"},
                f"{current_dir}/kas-cert.pem": {"bind": "/app/kas-cert.pem", "mode": "ro"},
                f"{current_dir}/kas-ec-cert.pem": {"bind": "/app/kas-ec-cert.pem", "mode": "ro"},
                f"{current_dir}/kas-private.pem": {"bind": "/app/kas-private.pem", "mode": "ro"},
                f"{current_dir}/kas-ec-private.pem": {"bind": "/app/kas-ec-private.pem", "mode": "ro"},
            },
            healthcheck={
                "test": ["CMD-SHELL", f"curl -sf {config['KEYCLOAK_SERVER_URL']} || exit 1"],
                "interval": 10000000000,  # 10s in nanoseconds
                "timeout": 5000000000,  # 5s in nanoseconds
                "retries": 5,
            },
        )
        print("OpenTDF container started.")
    except APIError as e:
        print(f"Error starting OpenTDF container: {e}")

# Main function
def run(config):
    ensure_network(config)
    run_postgres_container(config)
    utils_docker.wait_for_db(db_url="opentdfdb:5432", db_user="opentdf")
    run_opentdf_container(config)

