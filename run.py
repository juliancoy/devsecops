import os
import shutil
import sys
import util
import time
import os
import sys
import utils_docker
import json

here = os.path.abspath(os.path.dirname(__file__))

# create env.py file if this is the first run
util.initializeFiles()

print("Reading env.py")
import env

print("Applying env var substitutions in hard-coded .template files")
util.substitutions(here, env)
util.writeViteEnv(vars(env))

if not os.path.isdir(env.keys_dir):
    if env.USER_WEBSITE == "localhost":
        os.system("cd certs && ./init-temp-keys.cmd")
    else:
        utils_docker.generateProdKeys(env)

# Convert env.py to a dictionary
config = vars(env)
# make sure the network is up
utils_docker.ensure_network(env.NETWORK_NAME)

# create the keycloak keys if they dont exist
if not os.path.isdir("certs/keys"):
    os.system("cd certs && ./init-temp-keys.sh")

# --- WEB APP ---
# theoretically has no dependencies
utils_docker.run_container(env.webapp)

# --- KEYCLOAK ---
utils_docker.run_container(env.keycloakdb)
utils_docker.wait_for_db(network=env.NETWORK_NAME, db_url="keycloakdb:5432")
utils_docker.run_container(env.keycloak)

# --- NGINX ---
if not os.path.isfile("certs/ca.crt"):
    if env.IS_EC2:
        utils_docker.generateProdKeys(outdir=env.certs_dir, website=env.USER_WEBSITE)
    else:
        utils_docker.generateDevKeys(outdir=env.certs_dir)
utils_docker.run_container(env.nginx)

# --- OPENTDF ---
utils_docker.run_container(env.opentdfdb)
utils_docker.wait_for_db(network=env.NETWORK_NAME, db_url="opentdfdb:5432")
utils_docker.wait_for_url(env.KEYCLOAK_INTERNAL_AUTH_URL, network=env.NETWORK_NAME)
utils_docker.run_container(env.opentdf)

# --- ORG ---
utils_docker.run_container(env.org)

# --- MATRIX SYNAPSE ---
utils_docker.run_container(env.synapsedb)
utils_docker.wait_for_db(network=env.NETWORK_NAME, db_url="synapsedb:5432")
utils_docker.run_container(env.synapse)

# --- OLLAMA !!! ---
utils_docker.run_container(env.ollama)
utils_docker.pullModels(["llama3.2", "ALIENTELLIGENCE/sigmundfreud"])

# --- BLUESKY PDS --- 
utils_docker.run_container(env.bluesky)
