import docker
import json
import subprocess
import os
import time
from datetime import datetime, timedelta
from typing import Dict, Optional, Any, List, Type

DOCKER_CLIENT = docker.from_env()

def list_containers(show_all: bool = False) -> str:
    """List Docker containers."""
    try:
        containers = DOCKER_CLIENT.containers.list(all=show_all)

        if not containers:
            return "No containers found"

        result = "CONTAINER ID\tIMAGE\tSTATUS\tNAMES\n"
        for container in containers:
            result += f"{container.short_id}\t{container.image.tags[0] if container.image.tags else 'none'}\t{container.status}\t{container.name}\n"

        return result

    except Exception as e:
        return f"Error listing containers: {str(e)}"

def _extract_log_patterns(logs: str) -> Dict[str, Any]:
    """Analyze logs for common patterns and anomalies."""
    lines = logs.split('\n')
    analysis = {
        "total_lines": len(lines),
        "error_count": sum(1 for line in lines if 'error' in line.lower()),
        "warning_count": sum(1 for line in lines if 'warn' in line.lower()),
        "patterns": {},
        "timestamps": []
    }

    # Extract timestamps if they exist
    for line in lines:
        try:
            if line and len(line) > 20:
                timestamp_str = line[:23]
                timestamp = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S.%f')
                analysis["timestamps"].append(timestamp)
        except (ValueError, IndexError):
            continue

    return analysis

def analyze_logs(self,
                    container_name: str,
                    time_range_minutes: Optional[int] = 60,
                    filters: Optional[Dict[str, str]] = None,
                    max_lines: Optional[int] = 1000) -> Dict[str, Any]:
    """Analyze logs from a specific container with pattern detection."""
    try:
        container = DOCKER_CLIENT.containers.get(container_name)

        # Get logs with timestamp
        since = datetime.utcnow() - timedelta(minutes=time_range_minutes)
        logs = container.logs(
            since=since,
            until=datetime.utcnow(),
            timestamps=True,
            tail=max_lines
        ).decode('utf-8')

        # Apply filters if specified
        if filters:
            filtered_logs = []
            for line in logs.split('\n'):
                if all(value.lower() in line.lower() for value in filters.values()):
                    filtered_logs.append(line)
            logs = '\n'.join(filtered_logs)

        # Analyze logs
        analysis = self._extract_log_patterns(logs)

        # Add container info
        container_info = container.attrs
        analysis["container_info"] = {
            "id": container_info["Id"][:12],
            "name": container_info["Name"],
            "state": container_info["State"]["Status"],
            "created": container_info["Created"]
        }

        return {
            "success": True,
            "analysis": analysis,
            "raw_logs": logs if len(logs) < 1000 else f"{logs[:1000]}... (truncated)"
        }

    except docker.errors.NotFound:
        return {
            "success": False,
            "error": f"Container {container_name} not found"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
    
from docker.errors import NotFound, APIError

def container_running(container_name):
    """
    Check if a Docker container is running using the Docker Python SDK.

    :param container_name: Name of the Docker container
    :return: True if the container is running, otherwise False
    """
    client = docker.from_env()

    try:
        # Get the container
        container = client.containers.get(container_name)
        # Check the container status
        if container.status == "running":
            print(f"Container {container_name} is already running")
            return True

        print(f"Container {container_name} is in status '{container.status}'. Removing...")
        # Remove the container if it exists but is not running
        container.remove()
        return False

    except NotFound:
        print(f"Container {container_name} not found")
        return False
    except APIError as e:
        print(f"Error checking container status: {e}")
        raise RuntimeError(str(e))

def create_network(networkName):
    """Create Docker network if not exists"""
    try:
        DOCKER_CLIENT.networks.get(networkName)
        print(f"Network {networkName} already exists")
        return
    except:
        DOCKER_CLIENT.networks.create(networkName)
        print(f"Created Network {networkName}")
        return
    

def ensure_network(network_name):
    """Ensure the Docker network exists."""
    try:
        DOCKER_CLIENT.networks.get(network_name)
        print(f"Network {network_name} already exists.")
    except NotFound:
        DOCKER_CLIENT.networks.create(network_name)
        print(f"Network {network_name} created.")

def run_container(config):
    print(f'\033[4;32mAttempting to run container {config["name"]}\033[0m')
    if container_running(config["name"]):
        print(config["name"] + " already running")
        return
    try:
        DOCKER_CLIENT.containers.run(**config)
        print(f'{config["name"]} container started.')
    except APIError as e:
        print(f'Error starting {config["name"]} container: {e}')

def wait_for_db(network, db_url, db_user="postgres", max_attempts=30, delay=2):
    print(f"Using db_url: {db_url}")
    print(f"Waiting for the database to respond on {db_url}...")
    host, port = db_url.split(":")

    while True:
        try:
            subprocess.run(
                [
                    "docker",
                    "run",
                    "--rm",
                    "--network",
                    network,
                    "postgres:15-alpine",
                    "sh",
                    "-c",
                    f"pg_isready -h {host} -p {port} -U {db_user} >/dev/null 2>&1"
                ],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            print(f"The database is accepting connections on {db_url}!")
            break
        except subprocess.CalledProcessError:
            print(f"Still waiting for the database to accept connections on {db_url}...")
            time.sleep(2)
