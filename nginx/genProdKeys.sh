import subprocess

# Define the Docker command
command = [
    "docker", "run", "--rm", "-it",
    "-v", "/etc/letsencrypt:/etc/letsencrypt",
    "certbot/certbot",
    "certonly",
    "--register-unsafely-without-email",
    "--standalone",
    "-d", "arkavo.org"
]

# Execute the command
try:
    subprocess.run(command, check=True)
    print("Certificate process completed successfully.")
except subprocess.CalledProcessError as e:
    print(f"An error occurred: {e}")
