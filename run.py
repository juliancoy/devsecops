import os
import shutil
import sys
import util 
import time
import os
import sys 
import utils_docker

here = os.path.abspath(os.path.dirname(__file__))

# create env.py file if this is the first run
util.initializeFiles()

print("Reading env.py")
import env
print("Applying env var substitutions in hard-coded .template files")
util.substitutions(here, env)

# Convert env.py to a dictionary
config = vars(env)
# make sure the network is up
utils_docker.ensure_network(env.BRAND_NAME)

# start up keycloak
utils_docker.run_container(env.keycloakdb)
utils_docker.wait_for_db(network=env.BRAND_NAME, db_url="keycloakdb:5432")
utils_docker.run_container(env.keycloak)

utils_docker.run_container(env.opentdfdb)
utils_docker.wait_for_db(network=env.BRAND_NAME, db_url="opentdfdb:5432")
utils_docker.run_container(env.opentdf)
