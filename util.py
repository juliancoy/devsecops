import os
import sys
import shutil
import docker

def writeViteEnv(env, output_file="webapp/.env"):
    print("Writing environment file for web app")
    # Open the file for writing
    with open(output_file, "w") as f:
        for key, value in env.items():
            if not key.startswith("__") and isinstance(value, (str, int, float)):
                f.write(f"{key}={value}\n")

    print(f"Environment variables have been written to {output_file}")


def substitutions(currdir, env): 
    if os.path.isdir(currdir):
        try:
            for file in os.listdir(currdir):
                substitutions(os.path.join(currdir, file), env)
        except:
            print(f"Couldn't process {currdir}")
    else:
        if currdir.endswith(".template"):
            print("Applying substitutions to " + currdir)
            with open(currdir, 'r') as f:
                templateText = f.read()
            for k, v in vars(env).items():
                templateText = templateText.replace("$"+k, str(v))
            newFile = currdir.replace(".template","")
            print(f"Writing to {newFile}")
            with open(newFile, 'w+') as f:
                f.write(templateText)

def initializeFiles():
    # Check if we are in a GitHub Actions environment
    in_github_actions = os.getenv("GITHUB_ACTIONS") == "true"
    print(in_github_actions)
    
    if not os.path.isfile("env.py"):
        shutil.copy("env.example.py", "env.py")
        print("env.py file did not exist and has been created. Please edit it to update the necessary values, then re-run this script.")
        
        # Exit only if not in GitHub Actions
        if not in_github_actions:
            sys.exit(1)
        else:
            print("Running in GitHub Actions, continuing without exiting.")

            import docker