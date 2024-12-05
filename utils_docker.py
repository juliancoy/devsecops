import docker
import json
import subprocess
import os
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
    

def containerRunning(container_name):
    """
    Check if a Docker container is running using subprocess.

    :param container_name: Name of the Docker container
    :return: True if the container is running, otherwise False
    """
    # Get the container status
    result = subprocess.run(
        ["docker", "inspect", "--format='{{.State.Status}}'", container_name],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    
    if result.returncode != 0:
        if "No such object" in result.stderr:
            print(f"Container {container_name} not found")
            return False
        else:
            print(f"Error checking container status: {result.stderr}")
            raise RuntimeError(result.stderr)

    # Extract the status
    status = result.stdout.strip().strip("'")
    if status == "running":
        print(f"Container {container_name} is already running")
        return True

    print(f"Container {container_name} is in status '{status}'. Removing...")
    # Remove the container if it exists but is not running
    remove_result = subprocess.run(
        ["docker", "rm", container_name],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if remove_result.returncode != 0:
        print(f"Error removing container {container_name}: {remove_result.stderr}")
        raise RuntimeError(remove_result.stderr)

    return False

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
    

def wait_for_db(db_url, db_user, max_attempts=30, delay=2):
    os.system(f"./wait_for_db.sh {db_url} {db_user}")
