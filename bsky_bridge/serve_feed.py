from flask import Flask, jsonify, request
from atproto import Client, models
import json
import os
import pickle
import time
import json

app = Flask(__name__)
feed_dict = {}
last_updated = 0  # Timestamp of the last update
update_interval = 300  # 5 minutes in seconds


@app.route("/", methods=["GET"])
def serve_feed():
    # PYTHON ERRS WITH THE FOLLOWING GLOBALS
    global last_updated
    global feed_dict

    """Serve the feed data."""
    did = "did:plc:y7crv2yh74s7qhmtx3mvbgv5"
    feed = "art-new"

    current_time = time.time()

    # Check if the feed file exists and if it was updated recently
    if current_time - last_updated < update_interval:
        app.logger.info("Returning existing feed")
        return json.dumps(feed_dict, indent=2)

    app.logger.info(f"Updating feed at {current_time}")
    # Initialize the client
    client = Client()
    client.login(os.getenv("BLUESKY_HANDLE"), os.getenv("BLUESKY_PASSWORD"))

    # Parse the feed URI
    #algorithm = f"at://{did}/app.bsky.feed.generator/{feed}"
    feed_uri = f"at://{did}/app.bsky.feed.generator/{feed}"

    # Get feed with correct parameter format
    data = client.app.bsky.feed.get_feed(
        {
            "feed": feed_uri,
            "limit": 50,
        },
    )

    # Save feed as JSON
    feed_dict = json.loads(data.model_dump_json())

    # Update the last_updated timestamp
    last_updated = current_time

    return json.dumps(feed_dict, indent=2)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
