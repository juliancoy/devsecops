docker run --rm --net=host \
  -v "$(pwd)":/app \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -w /app \
  python:3.12 sh -c "pip install docker && python3 run.py"
