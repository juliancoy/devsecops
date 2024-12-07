docker run --rm --net=host \
  -v "$(pwd)":/app \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -w /app \
  -e GITHUB_ACTIONS=$GITHUB_ACTIONS \
  -v /usr/bin/docker:/usr/bin/docker \
  python:3.12 bash -c "pip install docker && python3 run.py"
