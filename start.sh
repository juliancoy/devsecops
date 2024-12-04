#!/bin/bash

# Start EVERYTHING
#!/bin/bash

# Initialize everything
# Run this script once after downloading the repo
# Then you can customize .env.public and .env.secret
# without checking them into the shared repository
if [ ! -f .env.changeme ]; then
  cp .env.public.example .env.public
  cp .env.secret.example .env.secret
  cp .env.changeme.example .env.changeme
  echo ".env.changeme file has been created. Please edit it to update the necessary values, then re-run this script."
  exit 1
fi

echo ".env.changeme exists. Proceeding with the script..."
source .env.changeme
source .docker_utils.sh
# Iterate over the directories
# Some services have one-time tasks like key generation
for dir in "${SERVICES_TO_RUN[@]}"; do
  # Check if the directory exists
  if [ -d "$dir" ]; then
    echo "Entering directory: $dir"
    cd "$dir" || exit

    # Check if init.sh exists and is executable
    if [ -x "start.sh" ]; then
      echo -e "Running \033[0;32m$dir/start.sh\033[0m"
      ./start.sh
    else
      echo "Nothing to do: start.sh not found or not executable in $dir"
    fi

    # Return to the original directory
    cd - > /dev/null || exit
  else
    echo "Directory $dir does not exist"
  fi
done
